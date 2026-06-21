"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarClock, CheckCircle, Cloud, FolderSync, KeyRound, Link2, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  deletePriceLabsMapping,
  getConnections,
  getGoogleDriveFolders,
  getPriceLabsListings,
  getProperties,
  mapPriceLabsListing,
  savePriceLabsApiKey,
  testPriceLabsConnection
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DriveFolderMapping, PriceLabsListing, PriceLabsMapping, Property } from "@/types";

export default function ConnectionsPage() {
  const queryClient = useQueryClient();
  const { data: connections } = useQuery({ queryKey: ["connections"], queryFn: getConnections });
  const { data: folders = [] } = useQuery<DriveFolderMapping[]>({ queryKey: ["connections-drive-folders"], queryFn: getGoogleDriveFolders });
  const { data: properties = [] } = useQuery<Property[]>({ queryKey: ["properties"], queryFn: getProperties });
  const { data: priceLabsListings = { listings: [] } } = useQuery<{ listings: PriceLabsListing[] }>({ queryKey: ["pricelabs-listings"], queryFn: getPriceLabsListings });

  const googleDrive = connections?.google_drive;
  const airbnb = connections?.airbnb_ical;
  const priceLabs = connections?.pricelabs;
  const airbnbConnections = airbnb?.connections ?? [];
  const connectedAirbnb = airbnbConnections.filter((item: any) => item.connected);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Conexiones</h2>
        <p className="text-sm text-slate-500">Cuentas externas y carpetas vinculadas por vivienda.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-50 text-blue-700">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Google Drive</h3>
                <p className="text-sm text-slate-500">{googleDrive?.configured ? "OAuth configurado" : "OAuth pendiente de configurar en Railway"}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{folders.length} carpetas</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Scope: {googleDrive?.scope || "Sin scope configurado"}</p>
          </div>
        </div>
      </Card>

      <PriceLabsPanel
        priceLabs={priceLabs}
        listings={priceLabsListings.listings ?? []}
        properties={properties}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["connections"] });
          queryClient.invalidateQueries({ queryKey: ["pricelabs-listings"] });
        }}
      />

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-rose-50 text-coral">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Airbnb iCal + CSV</h3>
                <p className="text-sm text-slate-500">Metodo: URL iCal por vivienda - CSV de ingresos - sin OAuth - sin API oficial</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{connectedAirbnb.length} viviendas conectadas</span>
            </div>
            <div className="mt-4 grid gap-3">
              {airbnbConnections.map((item: any) => (
                <div key={item.property_id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.property_alias}</p>
                      <p className="text-sm text-slate-500">
                        {item.connected ? "Conectado" : "No configurado"} - ultima sincronizacion: {formatDate(item.airbnb_last_sync_at)} - reservas: {item.reservations_imported ?? 0} - pendientes: {item.incomes_missing_amount ?? 0}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        CSV ingresos: {item.last_csv_imported_at ? `${formatDate(item.last_csv_imported_at)} - ${labelCsvStatus(item.csv_import_status)}` : "sin importar"}
                      </p>
                    </div>
                    <Link href={`/properties/${item.property_id}?tab=Reservas`} className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">Gestionar</Link>
                  </div>
                </div>
              ))}
              {airbnbConnections.length === 0 && <p className="text-sm text-slate-500">Todavia no hay viviendas con Airbnb iCal configurado.</p>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {folders.map((folder) => (
          <Card key={folder.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-meadow">
                <FolderSync className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{folder.drive_folder_name}</p>
                <p className="text-sm text-slate-500">{folder.property_alias} - {folder.folder_type} - {folder.provider_hint || "sin proveedor"}</p>
                <p className="mt-1 text-xs text-slate-500">Ultima sincronizacion: {formatDate(folder.last_sync_at)} - archivos: {folder.file_count ?? 0}</p>
              </div>
            </div>
          </Card>
        ))}
        {folders.length === 0 && <Card className="p-5 text-sm text-slate-500">Todavia no hay carpetas Drive vinculadas.</Card>}
      </div>
    </div>
  );
}

function PriceLabsPanel({ priceLabs, listings, properties, onChanged }: { priceLabs: any; listings: PriceLabsListing[]; properties: Property[]; onChanged: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedListingKey, setSelectedListingKey] = useState("");
  const [message, setMessage] = useState("");
  const mappings = (priceLabs?.mappings ?? []) as PriceLabsMapping[];
  const mappedKeys = useMemo(() => new Set(mappings.map((item) => listingKey(item))), [mappings]);
  const availableListings = listings.filter((item) => !mappedKeys.has(listingKey(item)));

  const saveKey = useMutation({
    mutationFn: () => savePriceLabsApiKey({ api_key: apiKey }),
    onSuccess: () => {
      setApiKey("");
      setMessage("API key guardada.");
      onChanged();
    },
    onError: (error: any) => setMessage(error?.response?.data?.error ?? "No se pudo guardar la API key.")
  });
  const testConnection = useMutation({
    mutationFn: testPriceLabsConnection,
    onSuccess: (data) => {
      setMessage(`Conexion correcta. Listings detectados: ${data.listings_count ?? 0}.`);
      onChanged();
    },
    onError: (error: any) => setMessage(error?.response?.data?.error ?? "No se pudo probar PriceLabs.")
  });
  const mapListing = useMutation({
    mutationFn: () => {
      const listing = listings.find((item) => listingKey(item) === selectedListingKey);
      return mapPriceLabsListing({
        property_id: selectedPropertyId,
        pricelabs_listing_id: listing?.pricelabs_listing_id,
        pms: listing?.pms
      });
    },
    onSuccess: () => {
      setSelectedListingKey("");
      setSelectedPropertyId("");
      setMessage("Listing asociado a vivienda.");
      onChanged();
    },
    onError: (error: any) => setMessage(error?.response?.data?.error ?? "No se pudo asociar el listing.")
  });
  const removeMapping = useMutation({
    mutationFn: deletePriceLabsMapping,
    onSuccess: () => {
      setMessage("Mapeo eliminado.");
      onChanged();
    },
    onError: (error: any) => setMessage(error?.response?.data?.error ?? "No se pudo eliminar el mapeo.")
  });

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-md bg-emerald-50 text-meadow">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">PriceLabs</h3>
              <p className="text-sm text-slate-500">Customer API disponible. CSV/Excel queda como respaldo manual.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
              {priceLabs?.configured ? "API key configurada" : "Disponible"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">API key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={priceLabs?.configured ? "Clave guardada. Pega una nueva para reemplazarla." : "Pega la API key de PriceLabs"}
                    className="h-10 rounded-md border border-slate-300 px-3"
                  />
                </label>
                <Button type="button" onClick={() => saveKey.mutate()} disabled={!apiKey || saveKey.isPending} className="self-end">
                  <KeyRound className="h-4 w-4" /> Guardar
                </Button>
                <Button type="button" onClick={() => testConnection.mutate()} disabled={!priceLabs?.configured || testConnection.isPending} className="self-end bg-meadow hover:bg-emerald-700">
                  <RefreshCw className="h-4 w-4" /> Probar
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Se usa `X-API-Key`. No se guarda usuario ni contrasena de PriceLabs. Limite documentado: {priceLabs?.rate_limit ?? "60/min, 1000/hour"}.
              </p>
              {message && <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>}
            </div>

            <div className="rounded-md border border-slate-200 p-4">
              <p className="font-semibold">Estado</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-meadow" /> Listings cacheados: {priceLabs?.listings_cached ?? listings.length ?? 0}</p>
                <p>Ultima prueba: {formatDate(priceLabs?.connection?.last_tested_at)}</p>
                <p>Mapeos activos: {mappings.length}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-slate-200 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Vivienda Hogarflow</span>
                <select value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
                  <option value="">Selecciona vivienda</option>
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.alias}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Listing PriceLabs</span>
                <select value={selectedListingKey} onChange={(event) => setSelectedListingKey(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
                  <option value="">Selecciona listing</option>
                  {availableListings.map((listing) => (
                    <option key={listingKey(listing)} value={listingKey(listing)}>
                      {listing.listing_name} · {listing.pms}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" onClick={() => mapListing.mutate()} disabled={!selectedPropertyId || !selectedListingKey || mapListing.isPending} className="self-end">
                <Link2 className="h-4 w-4" /> Asociar
              </Button>
            </div>
            {listings.length === 0 && <p className="mt-3 text-sm text-slate-500">Guarda la API key y pulsa Probar para cargar listings de PriceLabs.</p>}
          </div>

          <div className="mt-4 grid gap-3">
            {mappings.map((mapping) => (
              <div key={mapping.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div>
                  <p className="font-semibold">{mapping.property_alias}</p>
                  <p className="text-sm text-slate-500">{mapping.listing_name} - {mapping.pms} - {mapping.pricelabs_listing_id}</p>
                </div>
                <button type="button" onClick={() => removeMapping.mutate(mapping.id)} className="text-sm font-semibold text-rose-600">Quitar mapeo</button>
              </div>
            ))}
            {mappings.length === 0 && <p className="text-sm text-slate-500">Todavia no hay listings de PriceLabs asociados a viviendas.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function listingKey(listing: Pick<PriceLabsListing, "pms" | "pricelabs_listing_id">) {
  return `${listing.pms}:${listing.pricelabs_listing_id}`;
}

function labelCsvStatus(value?: string | null) {
  const labels: Record<string, string> = {
    pending_review: "pendiente de revision",
    ready_to_apply: "lista para aplicar",
    needs_review: "necesita revision",
    partially_applied: "parcialmente aplicada",
    applied: "aplicada"
  };
  return labels[String(value ?? "")] ?? String(value ?? "pendiente");
}
