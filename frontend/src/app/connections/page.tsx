"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarClock, Cloud, FolderSync } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getConnections, getGoogleDriveFolders } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DriveFolderMapping } from "@/types";

export default function ConnectionsPage() {
  const { data: connections } = useQuery({ queryKey: ["connections"], queryFn: getConnections });
  const { data: folders = [] } = useQuery<DriveFolderMapping[]>({ queryKey: ["connections-drive-folders"], queryFn: getGoogleDriveFolders });
  const googleDrive = connections?.google_drive;
  const airbnb = connections?.airbnb_ical;
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

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-rose-50 text-coral">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Airbnb iCal</h3>
                <p className="text-sm text-slate-500">Metodo: URL iCal por vivienda · sin OAuth · sin API oficial</p>
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
                        {item.connected ? "Conectado" : "No configurado"} · ultima sincronizacion: {formatDate(item.airbnb_last_sync_at)} · reservas: {item.reservations_imported ?? 0} · pendientes: {item.incomes_missing_amount ?? 0}
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
                <p className="text-sm text-slate-500">{folder.property_alias} · {folder.folder_type} · {folder.provider_hint || "sin proveedor"}</p>
                <p className="mt-1 text-xs text-slate-500">Ultima sincronizacion: {formatDate(folder.last_sync_at)} · archivos: {folder.file_count ?? 0}</p>
              </div>
            </div>
          </Card>
        ))}
        {folders.length === 0 && <Card className="p-5 text-sm text-slate-500">Todavia no hay carpetas Drive vinculadas.</Card>}
      </div>
    </div>
  );
}
