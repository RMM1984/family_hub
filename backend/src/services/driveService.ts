import { query } from "../config/db.js";
import { env } from "../config/env.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";
import { validateProperty } from "./crudService.js";

const documentTypes = new Set(["factura", "contrato", "seguro", "ibi", "comunidad", "mantenimiento", "reserva", "otro"]);

type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  createdTime?: string;
  modifiedTime?: string;
};

export async function getDriveState(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const integration = await query("select id, property_id, provider, folder_id, folder_name, folder_url, connected_at, last_sync_at, is_active from property_drive_integrations where property_id = $1 and provider = 'google_drive' and is_active = true", [propertyId], schemaName);
  const files = await listFiles(schemaName, propertyId);
  return {
    integration: integration.rows[0] ?? null,
    files,
    google_configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
    scope: env.GOOGLE_DRIVE_SCOPE
  };
}

export async function getAuthUrl(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  ensureGoogleConfig();
  const state = Buffer.from(JSON.stringify({ propertyId })).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", env.GOOGLE_DRIVE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return { url: url.toString(), scope: env.GOOGLE_DRIVE_SCOPE };
}

export async function connectFolder(schemaName: string, propertyId: string, userId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const folderId = parseFolderId(String(input.folder_id ?? input.folder_url ?? ""));
  if (!folderId) {
    const err = new Error("Debes indicar una carpeta de Google Drive valida") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  let accessToken = typeof input.access_token === "string" && input.access_token ? input.access_token : null;
  let refreshToken = typeof input.refresh_token === "string" && input.refresh_token ? input.refresh_token : null;
  let expiresAt: string | null = null;
  if (typeof input.authorization_code === "string" && input.authorization_code) {
    const tokens = await exchangeCode(input.authorization_code);
    accessToken = tokens.access_token ?? accessToken;
    refreshToken = tokens.refresh_token ?? refreshToken;
    expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null;
  }
  const folder = accessToken ? await fetchDriveFolder(accessToken, folderId) : null;
  const folderName = String(input.folder_name ?? folder?.name ?? "Carpeta Drive");
  const folderUrl = String(input.folder_url ?? folder?.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`);
  const result = await query(
    `insert into property_drive_integrations
      (property_id, folder_id, folder_name, folder_url, connected_by, encrypted_access_token, encrypted_refresh_token, token_expires_at, is_active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,true)
     on conflict (property_id, provider) do update set
      folder_id = excluded.folder_id,
      folder_name = excluded.folder_name,
      folder_url = excluded.folder_url,
      connected_by = excluded.connected_by,
      connected_at = now(),
      encrypted_access_token = coalesce(excluded.encrypted_access_token, property_drive_integrations.encrypted_access_token),
      encrypted_refresh_token = coalesce(excluded.encrypted_refresh_token, property_drive_integrations.encrypted_refresh_token),
      token_expires_at = coalesce(excluded.token_expires_at, property_drive_integrations.token_expires_at),
      is_active = true
     returning id, property_id, provider, folder_id, folder_name, folder_url, connected_at, last_sync_at, is_active`,
    [propertyId, folderId, folderName, folderUrl, userId, accessToken ? encryptSecret(accessToken) : null, refreshToken ? encryptSecret(refreshToken) : null, expiresAt],
    schemaName
  );
  return result.rows[0];
}

export async function syncFolder(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const integration = await getIntegrationWithTokens(schemaName, propertyId);
  if (!integration) {
    const err = new Error("La vivienda no tiene carpeta Drive conectada") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  const token = decryptSecret(integration.encrypted_access_token) ?? await refreshAccessToken(integration, schemaName);
  if (!token) {
    const err = new Error("Drive esta conectado, pero falta autorizar OAuth para sincronizar") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const files = await fetchDriveFiles(token, integration.folder_id);
  for (const file of files) {
    await query(
      `insert into drive_files
        (property_id, drive_folder_id, drive_file_id, name, mime_type, size, web_view_link, web_content_link, created_time, modified_time, synced_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       on conflict (property_id, drive_file_id) do update set
        name = excluded.name,
        mime_type = excluded.mime_type,
        size = excluded.size,
        web_view_link = excluded.web_view_link,
        web_content_link = excluded.web_content_link,
        created_time = excluded.created_time,
        modified_time = excluded.modified_time,
        synced_at = now()`,
      [propertyId, integration.folder_id, file.id, file.name, file.mimeType ?? null, file.size ? Number(file.size) : null, file.webViewLink ?? null, file.webContentLink ?? null, file.createdTime ?? null, file.modifiedTime ?? null],
      schemaName
    );
  }
  await query("update property_drive_integrations set last_sync_at = now() where id = $1", [integration.id], schemaName);
  return { imported: files.length, files: await listFiles(schemaName, propertyId) };
}

export async function listFiles(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const result = await query(
    `select df.*, e.description as linked_expense_description, d.title as linked_document_title
     from drive_files df
     left join expenses e on e.id = df.linked_expense_id and e.property_id = df.property_id
     left join documents d on d.id = df.linked_document_id and d.property_id = df.property_id
     where df.property_id = $1
     order by df.modified_time desc nulls last, df.synced_at desc`,
    [propertyId],
    schemaName
  );
  return result.rows;
}

export async function updateFile(schemaName: string, propertyId: string, fileId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  if (input.document_type !== undefined && input.document_type !== null && input.document_type !== "" && !documentTypes.has(String(input.document_type))) {
    const err = new Error("Tipo de documento no permitido") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const result = await query(
    `update drive_files
     set document_type = coalesce($1, document_type),
         expiration_date = $2,
         linked_expense_id = coalesce($3, linked_expense_id),
         linked_income_id = coalesce($4, linked_income_id),
         linked_document_id = coalesce($5, linked_document_id)
     where property_id = $6 and id = $7
     returning *`,
    [
      input.document_type === "" ? null : input.document_type ?? null,
      input.expiration_date === "" ? null : input.expiration_date ?? null,
      input.linked_expense_id ?? null,
      input.linked_income_id ?? null,
      input.linked_document_id ?? null,
      propertyId,
      fileId
    ],
    schemaName
  );
  if (!result.rows[0]) {
    const err = new Error("Archivo Drive no encontrado en esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

export async function linkExpense(schemaName: string, propertyId: string, fileId: string, expenseId: string) {
  const expense = await query("select id from expenses where id = $1 and property_id = $2", [expenseId, propertyId], schemaName);
  if (!expense.rows[0]) {
    const err = new Error("El gasto no pertenece a esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return updateFile(schemaName, propertyId, fileId, { linked_expense_id: expenseId });
}

export async function linkDocument(schemaName: string, propertyId: string, fileId: string, documentId: string) {
  const document = await query("select id from documents where id = $1 and property_id = $2", [documentId, propertyId], schemaName);
  if (!document.rows[0]) {
    const err = new Error("El documento no pertenece a esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return updateFile(schemaName, propertyId, fileId, { linked_document_id: documentId });
}

export async function disconnect(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  await query("update property_drive_integrations set is_active = false where property_id = $1 and provider = 'google_drive'", [propertyId], schemaName);
  return { message: "Drive desconectado" };
}

function ensureGoogleConfig() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    const err = new Error("Google Drive no esta configurado en el servidor") as Error & { status: number };
    err.status = 503;
    throw err;
  }
}

function parseFolderId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/) ?? trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? trimmed;
}

async function exchangeCode(code: string) {
  ensureGoogleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
      code
    })
  });
  if (!response.ok) throw new Error("No se pudo intercambiar el codigo OAuth de Google");
  return response.json() as Promise<{ access_token?: string; refresh_token?: string; expires_in?: number }>;
}

async function refreshAccessToken(integration: any, schemaName: string) {
  ensureGoogleConfig();
  const refreshToken = decryptSecret(integration.encrypted_refresh_token);
  if (!refreshToken) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  if (!response.ok) return null;
  const tokens = await response.json() as { access_token?: string; expires_in?: number };
  if (tokens.access_token) {
    await query("update property_drive_integrations set encrypted_access_token = $1, token_expires_at = $2 where id = $3", [encryptSecret(tokens.access_token), tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null, integration.id], schemaName);
  }
  return tokens.access_token ?? null;
}

async function getIntegrationWithTokens(schemaName: string, propertyId: string) {
  const result = await query("select * from property_drive_integrations where property_id = $1 and provider = 'google_drive' and is_active = true", [propertyId], schemaName);
  return result.rows[0] ?? null;
}

async function fetchDriveFolder(accessToken: string, folderId: string) {
  const fields = "id,name,mimeType,webViewLink";
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=${fields}&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error("No se pudo leer la carpeta de Google Drive");
  return response.json() as Promise<{ id: string; name: string; mimeType: string; webViewLink?: string }>;
}

async function fetchDriveFiles(accessToken: string, folderId: string) {
  const fields = "nextPageToken,files(id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime)";
  const files: DriveFile[] = [];
  let pageToken = "";
  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error("No se pudieron sincronizar archivos de Google Drive");
    const data = await response.json() as { nextPageToken?: string; files?: DriveFile[] };
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return files;
}
