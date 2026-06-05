import { query } from "../config/db.js";
import { env } from "../config/env.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";
import { validateProperty } from "./crudService.js";
import jwt from "jsonwebtoken";
import type { AuthUser } from "../types.js";

const documentTypes = new Set(["factura", "contrato", "seguro", "ibi", "comunidad", "mantenimiento", "reserva", "otro"]);
const folderTypes = new Set(["facturas", "documentos", "contratos", "seguros", "ibi", "comunidad", "mantenimiento", "reservas", "otros"]);
const reviewStatuses = new Set(["pending_review", "registered", "reviewed", "linked", "ignored"]);
const expenseCategories = new Set(["electricity","water","internet","community","cleaning","ibi","garbage","home_insurance","liability_insurance","rental_insurance","maintenance","repairs","furniture","airbnb_commission","mortgage","other"]);

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

type DriveFolder = {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
};

type GoogleOAuthState = {
  purpose: "google_drive_oauth";
  propertyId: string;
  schemaName: string;
  userId: string;
  tenantId: string;
};

export async function getDriveState(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const integration = await query(
    `select id, property_id, provider, folder_id, folder_name, folder_url, connected_at, last_sync_at, is_active,
            (encrypted_access_token is not null or encrypted_refresh_token is not null) as has_oauth_tokens
     from property_drive_integrations
     where property_id = $1 and provider = 'google_drive' and is_active = true`,
    [propertyId],
    schemaName
  );
  const folders = await listFolders(schemaName, propertyId);
  const files = await listFiles(schemaName, propertyId);
  const activeIntegration = integration.rows[0] ?? null;
  return {
    integration: activeIntegration,
    folders,
    files,
    google_configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
    google_connected: Boolean(activeIntegration?.has_oauth_tokens),
    scope: env.GOOGLE_DRIVE_SCOPE
  };
}

export async function getAuthUrl(schemaName: string, propertyId: string, user: AuthUser) {
  await validateProperty(schemaName, propertyId);
  ensureGoogleConfig();
  const state = signGoogleOAuthState({ purpose: "google_drive_oauth", propertyId, schemaName, userId: user.id, tenantId: user.tenant_id });
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

export async function completeOAuthCallback(code: string, state: string) {
  const parsedState = verifyGoogleOAuthState(state);
  await validateOAuthUser(parsedState);
  await validateProperty(parsedState.schemaName, parsedState.propertyId);
  const tokens = await exchangeCode(code);
  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token;
  await query(
    `insert into property_drive_integrations
      (property_id, folder_id, folder_name, folder_url, connected_by, encrypted_access_token, encrypted_refresh_token, token_expires_at, is_active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,true)
     on conflict (property_id, provider) do update set
      connected_by = excluded.connected_by,
      connected_at = now(),
      encrypted_access_token = coalesce(excluded.encrypted_access_token, property_drive_integrations.encrypted_access_token),
      encrypted_refresh_token = coalesce(excluded.encrypted_refresh_token, property_drive_integrations.encrypted_refresh_token),
      token_expires_at = coalesce(excluded.token_expires_at, property_drive_integrations.token_expires_at),
      is_active = true
     returning id`,
    [
      parsedState.propertyId,
      "google_oauth_account",
      "Cuenta Google Drive",
      null,
      parsedState.userId,
      accessToken ? encryptSecret(accessToken) : null,
      refreshToken ? encryptSecret(refreshToken) : null,
      tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null
    ],
    parsedState.schemaName
  );
  return {
    propertyId: parsedState.propertyId,
    redirectUrl: buildFrontendRedirect(parsedState.propertyId, "connected")
  };
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
  const integrationForFolder = accessToken ? null : await getIntegrationWithTokens(schemaName, propertyId);
  const existingToken = integrationForFolder ? decryptSecret(integrationForFolder.encrypted_access_token) ?? await refreshAccessToken(integrationForFolder, schemaName) : null;
  const folder = accessToken || existingToken ? await fetchDriveFolder(accessToken ?? existingToken!, folderId) : null;
  const folderName = String(input.folder_title ?? input.folder_name ?? folder?.name ?? "Carpeta Drive");
  const folderUrl = String(input.folder_url ?? folder?.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`);
  const folderType = normalizeFolderType(input.folder_type, folderName);
  const providerHint = normalizeProviderHint(input.provider_hint, folderName);
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
  const connection = result.rows[0];
  const mapping = await upsertFolderMapping(schemaName, propertyId, {
    connection_id: connection.id,
    drive_folder_id: folderId,
    drive_folder_name: folderName,
    drive_folder_url: folderUrl,
    folder_type: folderType,
    provider_hint: providerHint,
    metadata: { drive_folder_name: folder?.name ?? folderName },
    sync_enabled: input.sync_enabled
  });
  return { ...connection, folder_mapping: mapping };
}

export async function listAvailableFolders(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const integration = await getIntegrationWithTokens(schemaName, propertyId);
  if (!integration) {
    const err = new Error("Primero autoriza Google Drive para listar carpetas") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const token = decryptSecret(integration.encrypted_access_token) ?? await refreshAccessToken(integration, schemaName);
  if (!token) {
    const err = new Error("Drive esta conectado, pero falta un token OAuth valido") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  return fetchDriveFolders(token);
}

export async function syncFolder(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const folders = await listFolders(schemaName, propertyId);
  const first = folders.find((folder: any) => folder.sync_enabled) as any;
  if (!first) {
    const err = new Error("La vivienda no tiene carpetas Drive activas") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return syncFolderMapping(schemaName, propertyId, first.id);
}

export async function syncAll(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const folders = await listFolders(schemaName, propertyId);
  let imported = 0;
  for (const folder of folders as any[]) {
    if (!folder.sync_enabled) continue;
    const result = await syncFolderMapping(schemaName, propertyId, folder.id);
    imported += result.imported;
  }
  return { imported, files: await listFiles(schemaName, propertyId), folders: await listFolders(schemaName, propertyId) };
}

export async function syncFolderMapping(schemaName: string, propertyId: string, folderMappingId: string) {
  await validateProperty(schemaName, propertyId);
  const mapping = await getFolder(schemaName, propertyId, folderMappingId);
  if (!mapping) {
    const err = new Error("La carpeta Drive no pertenece a esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  if (!mapping.sync_enabled) {
    const err = new Error("La sincronizacion de esta carpeta esta desactivada") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const integration = mapping.connection_id
    ? await getIntegrationById(schemaName, mapping.connection_id)
    : await getIntegrationWithTokens(schemaName, propertyId);
  if (!integration) {
    const err = new Error("Falta conectar la cuenta Google Drive para sincronizar") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const token = decryptSecret(integration.encrypted_access_token) ?? await refreshAccessToken(integration, schemaName);
  if (!token) {
    const err = new Error("Drive esta conectado, pero falta autorizar OAuth para sincronizar") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const files = await fetchDriveFiles(token, mapping.drive_folder_id);
  for (const file of files) {
    await query(
      `insert into drive_files
        (property_id, drive_folder_mapping_id, drive_folder_id, drive_file_id, name, mime_type, size, web_view_link, web_content_link, created_time, modified_time, folder_type, provider_hint, source_folder_name, source_synced_at, synced_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
       on conflict (property_id, drive_file_id) do update set
        drive_folder_mapping_id = excluded.drive_folder_mapping_id,
        drive_folder_id = excluded.drive_folder_id,
        name = excluded.name,
        mime_type = excluded.mime_type,
        size = excluded.size,
        web_view_link = excluded.web_view_link,
        web_content_link = excluded.web_content_link,
        created_time = excluded.created_time,
        modified_time = excluded.modified_time,
        folder_type = excluded.folder_type,
        provider_hint = excluded.provider_hint,
        source_folder_name = excluded.source_folder_name,
        source_synced_at = now(),
        synced_at = now()`,
      [propertyId, mapping.id, mapping.drive_folder_id, file.id, file.name, file.mimeType ?? null, file.size ? Number(file.size) : null, file.webViewLink ?? null, file.webContentLink ?? null, file.createdTime ?? null, file.modifiedTime ?? null, mapping.folder_type, mapping.provider_hint ?? null, mapping.drive_folder_name],
      schemaName
    );
  }
  await query("update property_drive_folders set last_sync_at = now() where id = $1", [mapping.id], schemaName);
  await query("update property_drive_integrations set last_sync_at = now() where id = $1", [integration.id], schemaName);
  return { imported: files.length, folder: { ...mapping, last_sync_at: new Date().toISOString() }, files: await listFiles(schemaName, propertyId) };
}

export async function listFiles(schemaName: string, propertyId: string, filters: Record<string, string | undefined> = {}) {
  await validateProperty(schemaName, propertyId);
  const clauses = ["df.property_id = $1"];
  const params: unknown[] = [propertyId];
  const allowed: Record<string, string> = {
    folder_id: "df.drive_folder_mapping_id",
    folder_type: "df.folder_type",
    provider_hint: "df.provider_hint",
    review_status: "df.review_status"
  };
  for (const [key, column] of Object.entries(allowed)) {
    if (!filters[key]) continue;
    params.push(filters[key]);
    clauses.push(`${column} = $${params.length}`);
  }
  if (filters.unlinked === "true") clauses.push("df.linked_expense_id is null and df.linked_document_id is null and df.linked_income_id is null");
  const result = await query(
    `select df.*, p.alias as property_alias, e.description as linked_expense_description, d.title as linked_document_title
     from drive_files df
     join properties p on p.id = df.property_id
     left join expenses e on e.id = df.linked_expense_id and e.property_id = df.property_id
     left join documents d on d.id = df.linked_document_id and d.property_id = df.property_id
     where ${clauses.join(" and ")}
     order by df.modified_time desc nulls last, df.source_synced_at desc, df.synced_at desc`,
    params,
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
  if (input.review_status !== undefined && input.review_status !== null && !reviewStatuses.has(String(input.review_status))) {
    const err = new Error("Estado de revision no permitido") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const result = await query(
    `update drive_files
     set document_type = coalesce($1, document_type),
         expiration_date = case when $2::text = '__KEEP__' then expiration_date else $2::date end,
         linked_expense_id = coalesce($3, linked_expense_id),
         linked_income_id = coalesce($4, linked_income_id),
         linked_document_id = coalesce($5, linked_document_id),
         review_status = coalesce($6, review_status),
         provider_hint = coalesce($7, provider_hint),
         folder_type = coalesce($8, folder_type)
     where property_id = $9 and id = $10
     returning *`,
    [
      input.document_type === "" ? null : input.document_type ?? null,
      input.expiration_date === undefined ? "__KEEP__" : input.expiration_date === "" ? null : input.expiration_date,
      input.linked_expense_id ?? null,
      input.linked_income_id ?? null,
      input.linked_document_id ?? null,
      input.review_status ?? null,
      input.provider_hint === "" ? null : input.provider_hint ?? null,
      input.folder_type === "" ? null : input.folder_type ?? null,
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
  return updateFile(schemaName, propertyId, fileId, { linked_expense_id: expenseId, review_status: "linked" });
}

export async function linkDocument(schemaName: string, propertyId: string, fileId: string, documentId: string) {
  const document = await query("select id from documents where id = $1 and property_id = $2", [documentId, propertyId], schemaName);
  if (!document.rows[0]) {
    const err = new Error("El documento no pertenece a esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return updateFile(schemaName, propertyId, fileId, { linked_document_id: documentId, review_status: "linked" });
}

export async function registerExpenseFromFile(schemaName: string, propertyId: string, fileId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const file = await getDriveFile(schemaName, propertyId, fileId);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error("El importe del gasto es obligatorio") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const expenseDate = String(input.expense_date ?? "").trim();
  if (!expenseDate) {
    const err = new Error("La fecha del gasto es obligatoria") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const result = await query(
    `insert into expenses
      (property_id, category, provider, amount, expense_date, description, receipt_url, drive_file_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning *`,
    [
      propertyId,
      normalizeExpenseCategory(input.category),
      null,
      amount,
      expenseDate,
      String(input.description ?? input.concept ?? file.name ?? "Gasto Drive"),
      file.web_view_link ?? null,
      file.id
    ],
    schemaName
  );
  await updateFile(schemaName, propertyId, fileId, { linked_expense_id: result.rows[0].id, review_status: "registered" });
  return result.rows[0];
}

export async function saveDocumentFromFile(schemaName: string, propertyId: string, fileId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const file = await getDriveFile(schemaName, propertyId, fileId);
  const title = String(input.title ?? file.name ?? "").trim();
  if (!title) {
    const err = new Error("El titulo del documento es obligatorio") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const rawType = String(input.type ?? "otro").trim();
  const existing = await query("select id from documents where property_id = $1 and drive_file_id = $2", [propertyId, file.id], schemaName);
  if (existing.rows[0]) {
    const updated = await query(
      `update documents
       set type = $1,
           subtype = $2,
           title = $3,
           expiration_date = $4,
           file_url = $5,
           notes = $6
       where property_id = $7 and id = $8
       returning *`,
      [
        normalizeDocumentRecordType(rawType),
        rawType,
        title,
        input.expiration_date ? String(input.expiration_date) : null,
        file.web_view_link ?? null,
        input.notes ? String(input.notes) : null,
        propertyId,
        existing.rows[0].id
      ],
      schemaName
    );
    await updateFile(schemaName, propertyId, fileId, { linked_document_id: updated.rows[0].id, review_status: "linked" });
    return updated.rows[0];
  }
  const result = await query(
    `insert into documents
      (property_id, type, subtype, title, expiration_date, file_url, notes, details, drive_file_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning *`,
    [
      propertyId,
      normalizeDocumentRecordType(rawType),
      rawType,
      title,
      input.expiration_date ? String(input.expiration_date) : null,
      file.web_view_link ?? null,
      input.notes ? String(input.notes) : null,
      JSON.stringify({ source: "google_drive", drive_file_id: file.id, drive_file_name: file.name }),
      file.id
    ],
    schemaName
  );
  await updateFile(schemaName, propertyId, fileId, { linked_document_id: result.rows[0].id, review_status: "linked" });
  return result.rows[0];
}

export async function disconnect(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  await query("update property_drive_integrations set is_active = false where property_id = $1 and provider = 'google_drive'", [propertyId], schemaName);
  return { message: "Drive desconectado" };
}

export async function listFolders(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const result = await query(
    `select pdf.*, count(df.id)::int as file_count
     from property_drive_folders pdf
     left join drive_files df on df.drive_folder_mapping_id = pdf.id
     where pdf.property_id = $1
       and pdf.drive_folder_id <> 'google_oauth_account'
     group by pdf.id
     order by pdf.connected_at desc`,
    [propertyId],
    schemaName
  );
  return result.rows;
}

export async function createFolder(schemaName: string, propertyId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const folderId = parseFolderId(String(input.drive_folder_id ?? input.folder_id ?? input.folder_url ?? ""));
  if (!folderId) {
    const err = new Error("Debes indicar una carpeta de Google Drive valida") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const integration = await getIntegrationWithTokens(schemaName, propertyId);
  const token = integration ? decryptSecret(integration.encrypted_access_token) ?? await refreshAccessToken(integration, schemaName) : null;
  const driveFolder = token ? await fetchDriveFolder(token, folderId) : null;
  const folderName = String(input.folder_title ?? input.drive_folder_name ?? input.folder_name ?? driveFolder?.name ?? "Carpeta Drive");
  return upsertFolderMapping(schemaName, propertyId, {
    connection_id: input.connection_id ?? integration?.id ?? null,
    drive_folder_id: folderId,
    drive_folder_name: folderName,
    drive_folder_url: input.drive_folder_url ?? input.folder_url ?? driveFolder?.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`,
    folder_type: normalizeFolderType(input.folder_type, folderName),
    provider_hint: normalizeProviderHint(input.provider_hint, folderName),
    metadata: { drive_folder_name: driveFolder?.name ?? folderName },
    sync_enabled: input.sync_enabled
  });
}

export async function updateFolder(schemaName: string, propertyId: string, folderMappingId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const folderType = input.folder_type === undefined ? null : normalizeFolderType(input.folder_type, "");
  const result = await query(
    `update property_drive_folders
     set drive_folder_name = coalesce($1, drive_folder_name),
         drive_folder_url = coalesce($2, drive_folder_url),
         folder_type = coalesce($3, folder_type),
         provider_hint = $4,
         sync_enabled = coalesce($5, sync_enabled),
         metadata = coalesce($6, metadata)
     where property_id = $7 and id = $8
     returning *`,
    [
      input.drive_folder_name ?? input.folder_name ?? null,
      input.drive_folder_url ?? input.folder_url ?? null,
      folderType,
      input.provider_hint === undefined ? null : input.provider_hint,
      input.sync_enabled ?? null,
      input.metadata ?? null,
      propertyId,
      folderMappingId
    ],
    schemaName
  );
  if (!result.rows[0]) {
    const err = new Error("Carpeta Drive no encontrada en esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  await query("update drive_files set folder_type = $1, provider_hint = $2, source_folder_name = $3 where property_id = $4 and drive_folder_mapping_id = $5", [result.rows[0].folder_type, result.rows[0].provider_hint, result.rows[0].drive_folder_name, propertyId, folderMappingId], schemaName);
  return result.rows[0];
}

export async function deleteFolder(schemaName: string, propertyId: string, folderMappingId: string) {
  await validateProperty(schemaName, propertyId);
  await query("update drive_files set drive_folder_mapping_id = null where property_id = $1 and drive_folder_mapping_id = $2", [propertyId, folderMappingId], schemaName);
  const result = await query("delete from property_drive_folders where property_id = $1 and id = $2 returning id", [propertyId, folderMappingId], schemaName);
  if (!result.rows[0]) {
    const err = new Error("Carpeta Drive no encontrada en esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return { message: "Vinculo de carpeta eliminado" };
}

export async function listConnections(schemaName: string) {
  const [result, airbnb] = await Promise.all([
    query(
    `select pdi.id, pdi.provider, pdi.connected_at, pdi.last_sync_at, pdi.is_active,
            count(pdf.id)::int as folder_count
     from property_drive_integrations pdi
     left join property_drive_folders pdf on pdf.connection_id = pdi.id
     where pdi.provider = 'google_drive'
     group by pdi.id
     order by pdi.connected_at desc`,
    [],
    schemaName
    ),
    query(
      `select p.id as property_id,
              p.alias as property_alias,
              p.airbnb_enabled,
              p.airbnb_last_sync_at,
              latest_csv.uploaded_at as last_csv_imported_at,
              latest_csv.status as csv_import_status,
              (p.airbnb_ical_url is not null and p.airbnb_ical_url <> '') as connected,
              count(pr.id)::int as reservations_imported,
              count(i.id) filter (where i.amount_status = 'missing' or i.amount is null)::int as incomes_missing_amount
       from properties p
       left join property_reservations pr on pr.property_id = p.id and pr.source = 'airbnb' and coalesce(pr.is_demo,false) = false
       left join income i on i.property_id = p.id and i.reservation_id = pr.id
       left join lateral (
         select uploaded_at, status
         from airbnb_earnings_imports
         where property_id = p.id
         order by uploaded_at desc
         limit 1
       ) latest_csv on true
       where p.active = true
       group by p.id, latest_csv.uploaded_at, latest_csv.status
       order by p.airbnb_last_sync_at desc nulls last, p.alias asc`,
      [],
      schemaName
    )
  ]);
  return {
    google_drive: {
      configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
      scope: env.GOOGLE_DRIVE_SCOPE,
      connections: result.rows
    },
    airbnb_ical: {
      configured: true,
      method: "ical_per_property",
      oauth: false,
      official_api: false,
      connections: airbnb.rows
    }
  };
}

export async function listGoogleDriveFolders(schemaName: string) {
  const result = await query(
    `select pdf.*, p.alias as property_alias, p.address as property_address, count(df.id)::int as file_count
     from property_drive_folders pdf
     join properties p on p.id = pdf.property_id
     left join drive_files df on df.drive_folder_mapping_id = pdf.id
     group by pdf.id, p.id
     order by pdf.connected_at desc`,
    [],
    schemaName
  );
  return result.rows;
}

function ensureGoogleConfig() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    const err = new Error("Google Drive no esta configurado en el servidor") as Error & { status: number };
    err.status = 503;
    throw err;
  }
}

function signGoogleOAuthState(state: GoogleOAuthState) {
  return jwt.sign(state, env.JWT_SECRET, { expiresIn: "15m" });
}

function verifyGoogleOAuthState(state: string) {
  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as Partial<GoogleOAuthState>;
    if (
      payload.purpose !== "google_drive_oauth" ||
      typeof payload.propertyId !== "string" ||
      typeof payload.schemaName !== "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.tenantId !== "string"
    ) {
      throw new Error("Estado OAuth invalido");
    }
    return payload as GoogleOAuthState;
  } catch {
    const err = new Error("Estado OAuth invalido o caducado") as Error & { status: number };
    err.status = 400;
    throw err;
  }
}

async function validateOAuthUser(state: GoogleOAuthState) {
  const user = await query(
    `select u.id
     from public.users u
     join public.tenants t on t.id = u.tenant_id
     where u.id = $1 and u.tenant_id = $2 and t.schema_name = $3 and u.active = true and u.role = 'admin'`,
    [state.userId, state.tenantId, state.schemaName]
  );
  if (!user.rows[0]) {
    const err = new Error("Usuario OAuth no autorizado") as Error & { status: number };
    err.status = 403;
    throw err;
  }
}

export function buildFrontendRedirect(propertyId: string, status: "connected" | "error", message?: string) {
  const baseUrl = env.FRONTEND_URL ?? "http://localhost:3000";
  const url = new URL(`/properties/${propertyId}`, baseUrl);
  url.searchParams.set("tab", "Drive");
  url.searchParams.set("google", status);
  if (message) url.searchParams.set("message", message);
  return url.toString();
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

async function getIntegrationById(schemaName: string, integrationId: string) {
  const result = await query("select * from property_drive_integrations where id = $1 and provider = 'google_drive' and is_active = true", [integrationId], schemaName);
  return result.rows[0] ?? null;
}

async function getFolder(schemaName: string, propertyId: string, folderMappingId: string) {
  const result = await query("select * from property_drive_folders where property_id = $1 and id = $2", [propertyId, folderMappingId], schemaName);
  return result.rows[0] ?? null;
}

async function getDriveFile(schemaName: string, propertyId: string, fileId: string) {
  const result = await query("select * from drive_files where property_id = $1 and id = $2", [propertyId, fileId], schemaName);
  if (!result.rows[0]) {
    const err = new Error("Archivo Drive no encontrado en esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

async function upsertFolderMapping(schemaName: string, propertyId: string, input: Record<string, unknown>) {
  const result = await query(
    `insert into property_drive_folders
      (property_id, connection_id, drive_folder_id, drive_folder_name, drive_folder_url, folder_type, provider_hint, sync_enabled)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (property_id, drive_folder_id) do update set
       connection_id = coalesce(excluded.connection_id, property_drive_folders.connection_id),
       drive_folder_name = excluded.drive_folder_name,
       drive_folder_url = excluded.drive_folder_url,
       folder_type = excluded.folder_type,
       provider_hint = excluded.provider_hint,
       sync_enabled = excluded.sync_enabled
     returning *`,
    [
      propertyId,
      input.connection_id ?? null,
      input.drive_folder_id,
      input.drive_folder_name,
      input.drive_folder_url ?? null,
      input.folder_type,
      input.provider_hint ?? null,
      input.sync_enabled === undefined ? true : Boolean(input.sync_enabled)
    ],
    schemaName
  );
  return result.rows[0];
}

function normalizeFolderType(value: unknown, folderName: string) {
  const raw = String(value ?? "").toLowerCase().trim();
  if (folderTypes.has(raw)) return raw;
  const name = folderName.toLowerCase();
  if (name.includes("factura") || name.includes("iberdrola") || name.includes("simyo") || name.includes("movistar") || name.includes("pepephone")) return "facturas";
  if (name.includes("contrato")) return "contratos";
  if (name.includes("seguro")) return "seguros";
  if (name.includes("ibi")) return "ibi";
  if (name.includes("comunidad")) return "comunidad";
  if (name.includes("mantenimiento")) return "mantenimiento";
  if (name.includes("reserva") || name.includes("airbnb")) return "reservas";
  if (name.includes("document")) return "documentos";
  return "otros";
}

function normalizeProviderHint(value: unknown, folderName: string) {
  const raw = String(value ?? "").toLowerCase().trim();
  if (raw) return raw;
  const name = folderName.toLowerCase();
  for (const provider of ["iberdrola", "movistar", "pepephone", "simyo", "airbnb", "comunidad", "seguro"]) {
    if (name.includes(provider)) return provider;
  }
  return null;
}

function normalizeExpenseCategory(value: unknown) {
  const raw = String(value ?? "").toLowerCase().trim();
  const aliases: Record<string, string> = {
    suministros: "electricity",
    comunidad: "community",
    seguro: "home_insurance",
    impuestos: "ibi",
    mantenimiento: "maintenance",
    reforma: "repairs",
    limpieza: "cleaning",
    mobiliario: "furniture",
    hipoteca: "mortgage",
    otros: "other"
  };
  const category = aliases[raw] ?? raw;
  return expenseCategories.has(category) ? category : "other";
}

function normalizeDocumentRecordType(value: unknown) {
  const raw = String(value ?? "").toLowerCase().trim();
  const aliases: Record<string, string> = {
    contrato: "contract",
    seguro: "insurance",
    ibi: "other",
    comunidad: "other",
    certificado: "certificate",
    garantia: "warranty",
    garantía: "warranty",
    manual: "other",
    otro: "other"
  };
  const normalized = aliases[raw] ?? raw;
  return ["insurance", "license", "certificate", "inspection", "contract", "warranty", "deed", "other"].includes(normalized) ? normalized : "other";
}

async function fetchDriveFolder(accessToken: string, folderId: string) {
  const fields = "id,name,mimeType,webViewLink";
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=${fields}&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error("No se pudo leer la carpeta de Google Drive");
  return response.json() as Promise<{ id: string; name: string; mimeType: string; webViewLink?: string }>;
}

async function fetchDriveFolders(accessToken: string) {
  const folders: DriveFolder[] = [];
  let pageToken = "";
  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", "mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    url.searchParams.set("fields", "nextPageToken,files(id,name,modifiedTime,webViewLink)");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("orderBy", "modifiedTime desc");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error("No se pudieron listar carpetas de Google Drive");
    const data = await response.json() as { nextPageToken?: string; files?: DriveFolder[] };
    folders.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return folders;
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
