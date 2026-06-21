import { query } from "../config/db.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";
import { validateProperty } from "./crudService.js";

const PRICELABS_BASE_URL = "https://api.pricelabs.co";

type PriceLabsListing = {
  id?: string;
  pms?: string;
  name?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  country?: string | null;
  city_name?: string | null;
  state?: string | null;
  no_of_bedrooms?: number | null;
  channel_listing_details?: unknown;
  [key: string]: unknown;
};

export async function getPriceLabsConnection(schemaName: string) {
  const [connection, listings, mappings] = await Promise.all([
    query(
      `select id, provider, is_active, connected_at, last_tested_at, last_sync_at, last_error,
              encrypted_api_key is not null as has_api_key, metadata
       from pricelabs_connections
       where provider = 'pricelabs' and is_active = true
       order by connected_at desc
       limit 1`,
      [],
      schemaName
    ),
    query("select count(*)::int as count from pricelabs_listings", [], schemaName),
    listMappings(schemaName)
  ]);
  const row = connection.rows[0] ?? null;
  return {
    configured: Boolean(row?.has_api_key),
    status: row?.has_api_key ? "api_key_configured" : "available_api_or_csv",
    method: "customer_api",
    csv_available: true,
    official_api: true,
    auth: "api_key",
    base_url: PRICELABS_BASE_URL,
    rate_limit: "60/min, 1000/hour",
    connection: row,
    listings_cached: listings.rows[0]?.count ?? 0,
    mappings
  };
}

export async function saveApiKey(schemaName: string, userId: string, input: Record<string, unknown>) {
  const apiKey = String(input.api_key ?? "").trim();
  if (!apiKey || apiKey.length < 12) {
    const err = new Error("Introduce una API key valida de PriceLabs") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const encrypted = encryptSecret(apiKey);
  const result = await query(
    `insert into pricelabs_connections (provider, encrypted_api_key, connected_by, is_active)
     values ('pricelabs', $1, $2, true)
     on conflict (provider) where is_active = true do update set
       encrypted_api_key = excluded.encrypted_api_key,
       connected_by = excluded.connected_by,
       connected_at = now(),
       last_error = null,
       is_active = true
     returning id, provider, is_active, connected_at, last_tested_at, last_sync_at, last_error,
               encrypted_api_key is not null as has_api_key, metadata`,
    [encrypted, userId],
    schemaName
  );
  return result.rows[0];
}

export async function testConnection(schemaName: string) {
  const apiKey = await getApiKey(schemaName);
  const listings = await fetchListings(apiKey);
  await upsertListings(schemaName, listings);
  await query(
    "update pricelabs_connections set last_tested_at = now(), last_sync_at = now(), last_error = null where provider = 'pricelabs' and is_active = true",
    [],
    schemaName
  );
  return { ok: true, listings_count: listings.length, listings: normalizeListings(listings) };
}

export async function listListings(schemaName: string, refresh = false) {
  if (refresh) {
    return testConnection(schemaName);
  }
  const result = await query(
    `select pl.*, p.id as property_id, p.alias as property_alias
     from pricelabs_listings pl
     left join pricelabs_listing_mappings plm
       on plm.pricelabs_listing_id = pl.pricelabs_listing_id
      and plm.pms = pl.pms
      and plm.is_active = true
     left join properties p on p.id = plm.property_id
     order by pl.listing_name asc`,
    [],
    schemaName
  );
  return { listings: result.rows };
}

export async function mapListing(schemaName: string, input: Record<string, unknown>) {
  const propertyId = String(input.property_id ?? "").trim();
  const listingId = String(input.pricelabs_listing_id ?? input.listing_id ?? "").trim();
  const pms = String(input.pms ?? "").trim();
  if (!propertyId || !listingId || !pms) {
    const err = new Error("Selecciona vivienda y listing de PriceLabs") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  await validateProperty(schemaName, propertyId);
  const listing = await query(
    "select * from pricelabs_listings where pricelabs_listing_id = $1 and pms = $2",
    [listingId, pms],
    schemaName
  );
  if (!listing.rows[0]) {
    const err = new Error("Listing de PriceLabs no encontrado. Prueba la conexion primero.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  await query(
    `update pricelabs_listing_mappings
     set is_active = false
     where is_active = true
       and (property_id = $1 or (pricelabs_listing_id = $2 and pms = $3))`,
    [propertyId, listingId, pms],
    schemaName
  );
  const result = await query(
    `insert into pricelabs_listing_mappings
      (property_id, pricelabs_listing_id, pms, listing_name, is_active, metadata)
     values ($1,$2,$3,$4,true,$5::jsonb)
     returning *`,
    [
      propertyId,
      listingId,
      pms,
      listing.rows[0].listing_name,
      JSON.stringify({ channel_listing_details: listing.rows[0].channel_listing_details ?? [] })
    ],
    schemaName
  );
  return result.rows[0];
}

export async function deleteMapping(schemaName: string, mappingId: string) {
  const result = await query(
    "update pricelabs_listing_mappings set is_active = false where id = $1 returning id",
    [mappingId],
    schemaName
  );
  if (!result.rows[0]) {
    const err = new Error("Mapeo PriceLabs no encontrado") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return { message: "Mapeo PriceLabs eliminado" };
}

export async function listMappings(schemaName: string) {
  const result = await query(
    `select plm.*, p.alias as property_alias, p.address as property_address
     from pricelabs_listing_mappings plm
     join properties p on p.id = plm.property_id
     where plm.is_active = true
     order by p.alias asc`,
    [],
    schemaName
  );
  return result.rows;
}

async function getApiKey(schemaName: string) {
  const result = await query(
    "select encrypted_api_key from pricelabs_connections where provider = 'pricelabs' and is_active = true limit 1",
    [],
    schemaName
  );
  const encrypted = result.rows[0]?.encrypted_api_key;
  if (!encrypted) {
    const err = new Error("PriceLabs no tiene API key configurada") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  return decryptSecret(encrypted)!;
}

async function fetchListings(apiKey: string) {
  const url = new URL("/v1/listings", PRICELABS_BASE_URL);
  url.searchParams.set("skip_hidden", "true");
  const response = await fetch(url, {
    headers: { "X-API-Key": apiKey },
    signal: AbortSignal.timeout(300_000)
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`PriceLabs respondio ${response.status}: ${text.slice(0, 240)}`) as Error & { status: number };
    err.status = response.status === 401 || response.status === 403 ? 400 : 502;
    throw err;
  }
  const data = await response.json() as { listings?: PriceLabsListing[] };
  return Array.isArray(data.listings) ? data.listings : [];
}

async function upsertListings(schemaName: string, listings: PriceLabsListing[]) {
  for (const listing of listings) {
    const listingId = String(listing.id ?? "").trim();
    const pms = String(listing.pms ?? "").trim();
    const name = String(listing.name ?? listingId).trim();
    if (!listingId || !pms) continue;
    await query(
      `insert into pricelabs_listings
        (pricelabs_listing_id, pms, listing_name, latitude, longitude, country, city_name, state, no_of_bedrooms, channel_listing_details, raw_data, last_seen_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,now())
       on conflict (pms, pricelabs_listing_id) do update set
        listing_name = excluded.listing_name,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        country = excluded.country,
        city_name = excluded.city_name,
        state = excluded.state,
        no_of_bedrooms = excluded.no_of_bedrooms,
        channel_listing_details = excluded.channel_listing_details,
        raw_data = excluded.raw_data,
        last_seen_at = now()`,
      [
        listingId,
        pms,
        name,
        numberOrNull(listing.latitude),
        numberOrNull(listing.longitude),
        textOrNull(listing.country),
        textOrNull(listing.city_name),
        textOrNull(listing.state),
        numberOrNull(listing.no_of_bedrooms),
        JSON.stringify(listing.channel_listing_details ?? []),
        JSON.stringify(listing)
      ],
      schemaName
    );
  }
}

function normalizeListings(listings: PriceLabsListing[]) {
  return listings.map((listing) => ({
    pricelabs_listing_id: String(listing.id ?? ""),
    pms: String(listing.pms ?? ""),
    listing_name: String(listing.name ?? listing.id ?? ""),
    city_name: listing.city_name ?? null,
    country: listing.country ?? null,
    channel_listing_details: listing.channel_listing_details ?? []
  }));
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}
