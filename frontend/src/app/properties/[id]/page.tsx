"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, FileText, FolderSync, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createDriveFolder,
  createPropertyDocument,
  createPropertyExpense,
  createPropertyIncome,
  createReservationIncome,
  deleteDriveFolder,
  disconnectPropertyDrive,
  getAvailableDriveFolders,
  getPropertyAirbnbStats,
  getProperty,
  getPropertyDocuments,
  getPropertyDrive,
  getPropertyDriveAuthUrl,
  getPropertyExpenses,
  getPropertyIncome,
  getPropertyReservations,
  linkDriveFileDocument,
  linkDriveFileExpense,
  registerDriveFileExpense,
  savePropertyAirbnbIcal,
  saveDriveFileDocument,
  syncAllPropertyDrive,
  syncPropertyAirbnb,
  syncDriveFolder,
  syncPropertyDrive,
  updateDriveFile,
  updateDriveFolder,
  updatePropertyOperation,
  updatePropertyReservation
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AirbnbStats, AvailableDriveFolder, DocumentItem, DriveFile, DriveFolderMapping, DriveState, Expense, Income, Property, Reservation } from "@/types";

type Tab = "Resumen" | "Reservas" | "Contrato / Renta" | "Ingresos" | "Gastos" | "Documentos / Drive" | "Estadisticas";

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const propertyId = params.id;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "Drive" ? "Documentos / Drive" : "Resumen");
  const { data: property } = useQuery<Property>({ queryKey: ["property", propertyId], queryFn: () => getProperty(propertyId) });
  const operationType = property?.operation_type ?? property?.rental_type ?? (property?.type === "airbnb" ? "tourist" : property?.type ?? "mixed");
  const showAirbnb = operationType === "tourist" || operationType === "mixed" || Boolean(property?.airbnb_enabled);
  const { data: income = [] } = useQuery<Income[]>({ queryKey: ["property-income", propertyId], queryFn: () => getPropertyIncome(propertyId) });
  const { data: reservations = [] } = useQuery<Reservation[]>({ queryKey: ["property-reservations", propertyId], queryFn: () => getPropertyReservations(propertyId) });
  const { data: airbnbStats } = useQuery<AirbnbStats>({ queryKey: ["property-airbnb-stats", propertyId], queryFn: () => getPropertyAirbnbStats(propertyId), enabled: showAirbnb });
  const { data: expenses = [] } = useQuery<Expense[]>({ queryKey: ["property-expenses", propertyId], queryFn: () => getPropertyExpenses(propertyId) });
  const { data: documents = [] } = useQuery<DocumentItem[]>({ queryKey: ["property-documents", propertyId], queryFn: () => getPropertyDocuments(propertyId) });
  const { data: drive } = useQuery<DriveState>({ queryKey: ["property-drive", propertyId], queryFn: () => getPropertyDrive(propertyId) });
  const {
    data: availableDriveFolders = [],
    refetch: refetchAvailableDriveFolders,
    isFetching: loadingAvailableDriveFolders,
    error: availableDriveFoldersError
  } = useQuery<AvailableDriveFolder[]>({
    queryKey: ["property-drive-available-folders", propertyId, drive?.google_connected],
    queryFn: () => getAvailableDriveFolders(propertyId),
    enabled: Boolean(drive?.google_connected),
    retry: false
  });
  const totals = useMemo(() => {
    const totalIncome = income.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    return { totalIncome, totalExpenses, profit: totalIncome - totalExpenses };
  }, [income, expenses]);
  const tabs: Tab[] = showAirbnb
    ? ["Resumen", "Reservas", "Ingresos", "Gastos", "Documentos / Drive", "Estadisticas"]
    : ["Resumen", "Contrato / Renta", "Ingresos", "Gastos", "Documentos / Drive", "Estadisticas"];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-income", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-reservations", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-airbnb-stats", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-expenses", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["properties"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const expenseMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createPropertyExpense(propertyId, data), onSuccess: refresh });
  const incomeMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createPropertyIncome(propertyId, data), onSuccess: refresh });
  const propertyOperationMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => updatePropertyOperation(propertyId, data), onSuccess: refresh });
  const airbnbIcalMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => savePropertyAirbnbIcal(propertyId, data), onSuccess: refresh });
  const airbnbSyncMutation = useMutation({ mutationFn: () => syncPropertyAirbnb(propertyId), onSuccess: refresh });
  const reservationIncomeMutation = useMutation({ mutationFn: ({ reservationId, data }: { reservationId: string; data: Record<string, unknown> }) => createReservationIncome(propertyId, reservationId, data), onSuccess: refresh });
  const reservationUpdateMutation = useMutation({ mutationFn: ({ reservationId, data }: { reservationId: string; data: Record<string, unknown> }) => updatePropertyReservation(propertyId, reservationId, data), onSuccess: refresh });
  const documentMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createPropertyDocument(propertyId, data), onSuccess: refresh });
  const refreshDrive = () => queryClient.invalidateQueries({ queryKey: ["property-drive", propertyId] });
  const driveAuthorizeMutation = useMutation({
    mutationFn: () => getPropertyDriveAuthUrl(propertyId),
    onSuccess: (data) => {
      window.location.href = data.url;
    }
  });
  const driveFolderCreateMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createDriveFolder(propertyId, data), onSuccess: refreshDrive });
  const driveFolderUpdateMutation = useMutation({ mutationFn: ({ folderId, data }: { folderId: string; data: Record<string, unknown> }) => updateDriveFolder(propertyId, folderId, data), onSuccess: refreshDrive });
  const driveFolderDeleteMutation = useMutation({ mutationFn: (folderId: string) => deleteDriveFolder(propertyId, folderId), onSuccess: refreshDrive });
  const driveSyncMutation = useMutation({ mutationFn: () => syncPropertyDrive(propertyId), onSuccess: refreshDrive });
  const driveSyncAllMutation = useMutation({ mutationFn: () => syncAllPropertyDrive(propertyId), onSuccess: refreshDrive });
  const driveFolderSyncMutation = useMutation({ mutationFn: (folderId: string) => syncDriveFolder(propertyId, folderId), onSuccess: refreshDrive });
  const driveUpdateMutation = useMutation({ mutationFn: ({ fileId, data }: { fileId: string; data: Record<string, unknown> }) => updateDriveFile(propertyId, fileId, data), onSuccess: refreshDrive });
  const driveLinkExpenseMutation = useMutation({ mutationFn: ({ fileId, expenseId }: { fileId: string; expenseId: string }) => linkDriveFileExpense(propertyId, fileId, expenseId), onSuccess: refreshDrive });
  const driveLinkDocumentMutation = useMutation({ mutationFn: ({ fileId, documentId }: { fileId: string; documentId: string }) => linkDriveFileDocument(propertyId, fileId, documentId), onSuccess: refreshDrive });
  const driveDisconnectMutation = useMutation({ mutationFn: () => disconnectPropertyDrive(propertyId), onSuccess: refreshDrive });
  const driveRegisterExpenseMutation = useMutation({
    mutationFn: ({ fileId, data }: { fileId: string; data: Record<string, unknown> }) => registerDriveFileExpense(propertyId, fileId, data),
    onSuccess: refresh
  });
  const driveSaveDocumentMutation = useMutation({
    mutationFn: ({ fileId, data }: { fileId: string; data: Record<string, unknown> }) => saveDriveFileDocument(propertyId, fileId, data),
    onSuccess: refresh
  });

  if (!property) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/properties" className="text-sm font-semibold text-meadow">Volver a viviendas</Link>
          <h2 className="mt-1 text-2xl font-bold">{property.alias}</h2>
          <p className="text-sm text-slate-500">{property.address}</p>
          <p className="mt-2 inline-flex rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{labelOperationType(operationType)}</p>
        </div>
        <OperationTypeControl value={operationType} airbnbEnabled={Boolean(property.airbnb_enabled)} pending={propertyOperationMutation.isPending} onChange={(data) => propertyOperationMutation.mutate(data)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`h-10 whitespace-nowrap rounded-md px-4 text-sm font-semibold ${tab === item ? "bg-ink text-white" : "bg-white text-slate-600"}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === "Resumen" && (
        <section className="grid gap-4 md:grid-cols-3">
          <Metric title="Ingresos" value={formatCurrency(totals.totalIncome)} icon={<Wallet className="h-5 w-5" />} />
          <Metric title="Gastos" value={formatCurrency(totals.totalExpenses)} icon={<Receipt className="h-5 w-5" />} />
          <Metric title="Beneficio" value={formatCurrency(totals.profit)} icon={<CalendarClock className="h-5 w-5" />} />
          <Card className="p-5 md:col-span-3">
            <h3 className="font-bold">Proximos hitos</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <p className="rounded-md bg-slate-100 p-3 text-sm">Documento: <b>{documents[0]?.title ?? "Sin documentos"}</b> Â· {formatDate(documents[0]?.expiration_date)}</p>
              <p className="rounded-md bg-slate-100 p-3 text-sm">Reserva: <b>{income[0]?.guest_name ?? "Sin reservas"}</b> Â· {formatDate(income[0]?.check_in)}</p>
            </div>
          </Card>
        </section>
      )}

      {tab === "Reservas" && showAirbnb && (
        <ReservationsPanel
          property={property}
          reservations={reservations}
          stats={airbnbStats}
          pendingSave={airbnbIcalMutation.isPending}
          pendingSync={airbnbSyncMutation.isPending}
          pendingIncome={reservationIncomeMutation.isPending}
          onSaveIcal={(data) => airbnbIcalMutation.mutate(data)}
          onSync={() => airbnbSyncMutation.mutate()}
          onCreateIncome={(reservationId, data) => reservationIncomeMutation.mutate({ reservationId, data })}
          onUpdateReservation={(reservationId, data) => reservationUpdateMutation.mutate({ reservationId, data })}
        />
      )}

      {tab === "Contrato / Renta" && !showAirbnb && (
        <Card className="p-5">
          <h3 className="font-bold">Contrato / Renta</h3>
          <p className="mt-2 text-sm text-slate-500">Vivienda de larga estancia. Gestiona ingresos, gastos y documentos desde las pestañas de esta vivienda.</p>
        </Card>
      )}

      {tab === "Ingresos" && (
        <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <IncomeForm pending={incomeMutation.isPending} onSubmit={(data) => incomeMutation.mutate(data)} />
          <Card className="overflow-hidden">
            {income.map((item) => (
              <Row key={item.id} title={item.guest_name ?? "Reserva"} subtitle={`${formatDate(item.check_in)} - ${formatDate(item.check_out)} Â· ${item.nights ?? "-"} noches`} amount={item.amount} />
            ))}
          </Card>
        </section>
      )}

      {tab === "Gastos" && (
        <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <ExpenseForm pending={expenseMutation.isPending} onSubmit={(data) => expenseMutation.mutate(data)} />
          <Card className="overflow-hidden">
            {expenses.map((item) => (
              <Row key={item.id} title={item.provider ?? item.category} subtitle={`${item.description ?? "Gasto"} Â· ${formatDate(item.expense_date)}`} amount={item.amount} />
            ))}
          </Card>
        </section>
      )}

      {tab === "Documentos / Drive" && (
        <section className="space-y-5">
          <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <DocumentForm pending={documentMutation.isPending} onSubmit={(data) => documentMutation.mutate(data)} />
            <div className="grid gap-3">
              {documents.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.provider ?? item.type} · caduca {formatDate(item.expiration_date)}</p>
                    </div>
                    <p className="font-bold">{formatCurrency(item.cost)}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
          {drive && (
            <DrivePanel
              drive={drive}
              availableDriveFolders={availableDriveFolders}
              availableDriveFoldersError={availableDriveFoldersError}
              loadingAvailableDriveFolders={loadingAvailableDriveFolders}
              googleStatus={searchParams.get("google")}
              expenses={expenses}
              documents={documents}
              pendingConnect={driveFolderCreateMutation.isPending}
              pendingAuthorize={driveAuthorizeMutation.isPending}
              pendingSync={driveSyncMutation.isPending || driveSyncAllMutation.isPending || driveFolderSyncMutation.isPending}
              pendingUpdate={driveUpdateMutation.isPending || driveLinkExpenseMutation.isPending || driveLinkDocumentMutation.isPending || driveRegisterExpenseMutation.isPending || driveSaveDocumentMutation.isPending || driveDisconnectMutation.isPending}
              onAuthorize={() => driveAuthorizeMutation.mutate()}
              onLoadFolders={() => refetchAvailableDriveFolders()}
              onDisconnect={() => driveDisconnectMutation.mutate()}
              onCreateFolder={(data) => driveFolderCreateMutation.mutate(data)}
              onUpdateFolder={(folderId, data) => driveFolderUpdateMutation.mutate({ folderId, data })}
              onDeleteFolder={(folderId) => driveFolderDeleteMutation.mutate(folderId)}
              onSyncFolder={(folderId) => driveFolderSyncMutation.mutate(folderId)}
              onSyncAll={() => driveSyncAllMutation.mutate()}
              onSync={() => driveSyncMutation.mutate()}
              onUpdate={(fileId, data) => driveUpdateMutation.mutate({ fileId, data })}
              onLinkExpense={(fileId, expenseId) => driveLinkExpenseMutation.mutate({ fileId, expenseId })}
              onLinkDocument={(fileId, documentId) => driveLinkDocumentMutation.mutate({ fileId, documentId })}
              onRegisterExpense={(fileId, data) => driveRegisterExpenseMutation.mutate({ fileId, data })}
              onSaveDocument={(fileId, data) => driveSaveDocumentMutation.mutate({ fileId, data })}
            />
          )}
        </section>
      )}

      {tab === "Estadisticas" && (
        <section className="grid gap-4 md:grid-cols-2">
          <Metric title="ROI estimado" value={`${(((totals.profit || 0) / (Number(property.initial_investment ?? 0) + Number(property.reform_cost ?? 0) || 1)) * 100).toFixed(2)}%`} icon={<Wallet className="h-5 w-5" />} />
          <Metric title="Documentos activos" value={String(documents.length)} icon={<FileText className="h-5 w-5" />} />
        </section>
      )}
    </div>
  );
}
function DrivePanel({
  drive,
  availableDriveFolders,
  availableDriveFoldersError,
  loadingAvailableDriveFolders,
  googleStatus,
  expenses,
  documents,
  pendingConnect,
  pendingAuthorize,
  pendingSync,
  pendingUpdate,
  onAuthorize,
  onLoadFolders,
  onDisconnect,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onSyncFolder,
  onSyncAll,
  onSync,
  onUpdate,
  onLinkExpense,
  onLinkDocument,
  onRegisterExpense,
  onSaveDocument
}: {
  drive: DriveState;
  availableDriveFolders: AvailableDriveFolder[];
  availableDriveFoldersError: unknown;
  loadingAvailableDriveFolders: boolean;
  googleStatus: string | null;
  expenses: Expense[];
  documents: DocumentItem[];
  pendingConnect: boolean;
  pendingAuthorize: boolean;
  pendingSync: boolean;
  pendingUpdate: boolean;
  onAuthorize: () => void;
  onLoadFolders: () => void;
  onDisconnect: () => void;
  onCreateFolder: (data: Record<string, unknown>) => void;
  onUpdateFolder: (folderId: string, data: Record<string, unknown>) => void;
  onDeleteFolder: (folderId: string) => void;
  onSyncFolder: (folderId: string) => void;
  onSyncAll: () => void;
  onSync: () => void;
  onUpdate: (fileId: string, data: Record<string, unknown>) => void;
  onLinkExpense: (fileId: string, expenseId: string) => void;
  onLinkDocument: (fileId: string, documentId: string) => void;
  onRegisterExpense: (fileId: string, data: Record<string, unknown>) => void;
  onSaveDocument: (fileId: string, data: Record<string, unknown>) => void;
}) {
  const [filter, setFilter] = useState("pending_review");
  const [folderFilter, setFolderFilter] = useState("todos");
  const filtered = drive.files.filter((file) => {
    if (folderFilter !== "todos" && file.drive_folder_mapping_id !== folderFilter) return false;
    if (filter === "todos") return true;
    if (filter === "registered") return file.review_status === "registered" || file.review_status === "linked";
    if (["pending_review", "reviewed", "linked", "ignored"].includes(filter)) return file.review_status === filter;
    return true;
  });
  const counts = drive.files.reduce<Record<string, number>>((acc, file) => {
    const status = file.review_status ?? "pending_review";
    acc[status] = (acc[status] ?? 0) + 1;
    acc.todos = (acc.todos ?? 0) + 1;
    acc.registered = (acc.registered ?? 0) + (status === "registered" || status === "linked" ? 1 : 0);
    return acc;
  }, { todos: 0 });

  return (
    <section className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Google Drive</h3>
            <p className="text-sm text-slate-500">Bandeja mensual para revisar facturas y documentos de esta vivienda.</p>
            <p className={`mt-2 inline-flex rounded-md px-3 py-1 text-sm font-semibold ${drive.google_connected ? "bg-emerald-50 text-meadow" : "bg-slate-100 text-slate-600"}`}>
              {drive.google_connected ? "Conectado a Google Drive" : "Google Drive pendiente de autorizar"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {drive.google_configured && !drive.google_connected && (
              <Button disabled={pendingAuthorize} onClick={onAuthorize} className="bg-ink">
                <ExternalLink className="h-4 w-4" />
                Autorizar Google
              </Button>
            )}
            {drive.google_connected && (
              <Button disabled={pendingUpdate} onClick={onDisconnect} className="bg-white text-coral hover:bg-slate-50">
                Desconectar
              </Button>
            )}
            <Button disabled={drive.folders.length === 0 || pendingSync} onClick={onSyncAll} className="bg-meadow hover:bg-green-700">
              <FolderSync className="h-4 w-4" />
              Sincronizar carpetas
            </Button>
          </div>
        </div>
        {googleStatus === "connected" && (
          <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-meadow">Google Drive conectado correctamente.</p>
        )}
        {!drive.google_configured && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-sun">Google Drive no esta configurado en Railway. Puedes preparar carpetas manuales; la sincronizacion real requiere OAuth y token autorizado.</p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-bold">Conectar carpeta real de Drive</h3>
        <DriveConnectForm
          folders={availableDriveFolders}
          googleConnected={Boolean(drive.google_connected)}
          pending={pendingConnect}
          loadingFolders={loadingAvailableDriveFolders}
          folderError={availableDriveFoldersError}
          onLoadFolders={onLoadFolders}
          onSubmit={onCreateFolder}
        />
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-bold">Carpetas conectadas</h3>
        <div className="grid gap-3">
          {drive.folders.map((folder) => (
            <DriveFolderCard key={folder.id} folder={folder} pending={pendingSync} onSync={onSyncFolder} onUpdate={onUpdateFolder} onDelete={onDeleteFolder} />
          ))}
          {drive.folders.length === 0 && <p className="text-sm text-slate-500">Todavia no has conectado ninguna carpeta de Drive para esta vivienda.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Bandeja de revisión</h3>
            <p className="text-sm text-slate-500">Revisa archivos nuevos y conviertelos en gastos o documentos.</p>
          </div>
          <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            <option value="todos">Todas las carpetas</option>
            {drive.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.drive_folder_name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {["pending_review", "registered", "reviewed", "ignored", "todos"].map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={`rounded-md px-3 py-2 text-sm font-semibold ${filter === item ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>
              {labelDriveFilter(item)} ({counts[item] ?? 0})
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3">
        {filtered.map((file) => (
          <DriveFileCard
            key={file.id}
            file={file}
            expenses={expenses}
            documents={documents}
            pending={pendingUpdate}
            onUpdate={onUpdate}
            onLinkExpense={onLinkExpense}
            onLinkDocument={onLinkDocument}
            onRegisterExpense={onRegisterExpense}
            onSaveDocument={onSaveDocument}
          />
        ))}
        {filtered.length === 0 && <Card className="p-5 text-sm text-slate-500">No hay archivos para este filtro.</Card>}
      </div>
    </section>
  );
}

function OperationTypeControl({ value, airbnbEnabled, pending, onChange }: { value: string; airbnbEnabled: boolean; pending: boolean; onChange: (data: Record<string, unknown>) => void }) {
  const [operationType, setOperationType] = useState(value);
  const [enabled, setEnabled] = useState(airbnbEnabled);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Tipo de operacion</span>
        <select value={operationType} onChange={(event) => setOperationType(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
          {["tourist", "long_term", "own_use", "mixed", "inactive"].map((item) => <option key={item} value={item}>{labelOperationType(item)}</option>)}
        </select>
      </label>
      <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Airbnb
      </label>
      <Button disabled={pending} onClick={() => onChange({ operation_type: operationType, airbnb_enabled: enabled })} className="bg-ink">Guardar</Button>
    </div>
  );
}

function ReservationsPanel({
  property,
  reservations,
  stats,
  pendingSave,
  pendingSync,
  pendingIncome,
  onSaveIcal,
  onSync,
  onCreateIncome,
  onUpdateReservation
}: {
  property: Property;
  reservations: Reservation[];
  stats?: AirbnbStats;
  pendingSave: boolean;
  pendingSync: boolean;
  pendingIncome: boolean;
  onSaveIcal: (data: Record<string, unknown>) => void;
  onSync: () => void;
  onCreateIncome: (reservationId: string, data: Record<string, unknown>) => void;
  onUpdateReservation: (reservationId: string, data: Record<string, unknown>) => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  function submitIcal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSaveIcal({ airbnb_ical_url: String(form.get("airbnb_ical_url") ?? "") });
  }
  return (
    <section className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Reservas</h3>
            <p className="text-sm text-slate-500">Fuente: Airbnb iCal</p>
            <p className="mt-2 text-sm text-slate-500">Airbnb iCal sincroniza fechas de reservas, pero el importe debe completarse manualmente.</p>
            <p className={`mt-3 inline-flex rounded-md px-3 py-1 text-sm font-semibold ${property.airbnb_ical_url ? "bg-emerald-50 text-meadow" : "bg-slate-100 text-slate-600"}`}>
              {property.airbnb_ical_url ? "URL iCal guardada" : "Airbnb no conectado"}
            </p>
            <p className="mt-2 text-xs text-slate-500">Ultima sincronizacion: {formatDate(property.airbnb_last_sync_at)}</p>
          </div>
          <Button disabled={!property.airbnb_ical_url || pendingSync} onClick={onSync} className="bg-meadow hover:bg-green-700">Sincronizar ahora</Button>
        </div>
        <form onSubmit={submitIcal} className="mt-5 grid gap-3 lg:grid-cols-[1fr_160px]">
          <input name="airbnb_ical_url" defaultValue={property.airbnb_ical_url ?? ""} required placeholder="URL iCal de Airbnb" className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
          <Button disabled={pendingSave} className="bg-ink">Guardar URL</Button>
        </form>
      </Card>

      <section className="grid gap-3 md:grid-cols-5">
        <Metric title="Proximo check-in" value={formatDate(stats?.next_check_in)} icon={<CalendarClock className="h-5 w-5" />} />
        <Metric title="Proximo check-out" value={formatDate(stats?.next_check_out)} icon={<CalendarClock className="h-5 w-5" />} />
        <Metric title="Noches este mes" value={String(stats?.booked_nights_current_month ?? 0)} icon={<CalendarClock className="h-5 w-5" />} />
        <Metric title="Ocupacion 30 dias" value={`${stats?.occupancy_next_30_days ?? 0}%`} icon={<Wallet className="h-5 w-5" />} />
        <Metric title="Importes pendientes" value={String(stats?.incomes_missing_amount ?? 0)} icon={<Receipt className="h-5 w-5" />} />
      </section>

      <ReservationCalendar reservations={reservations} month={monthCursor} onMonthChange={setMonthCursor} />

      <div className="grid gap-3">
        {reservations.map((reservation) => (
          <ReservationCard
            key={reservation.id}
            reservation={reservation}
            pending={pendingIncome}
            onCreateIncome={onCreateIncome}
            onUpdateReservation={onUpdateReservation}
          />
        ))}
        {reservations.length === 0 && <Card className="p-5 text-sm text-slate-500">Todavia no hay reservas sincronizadas para esta vivienda.</Card>}
      </div>
    </section>
  );
}
function ReservationCard({ reservation, pending, onCreateIncome, onUpdateReservation }: { reservation: Reservation; pending: boolean; onCreateIncome: (reservationId: string, data: Record<string, unknown>) => void; onUpdateReservation: (reservationId: string, data: Record<string, unknown>) => void }) {
  const [amount, setAmount] = useState(reservation.income_amount?.toString() ?? "");
  const hasIncome = Boolean(reservation.income_id);
  const amountPending = !hasIncome || reservation.income_amount_status === "missing" || reservation.income_amount === null || reservation.income_amount === undefined;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">{reservation.guest_name ?? reservation.title ?? "Reserva Airbnb"}</p>
          <p className="text-sm text-slate-500">Check-in: {formatDate(reservation.check_in)} · Check-out: {formatDate(reservation.check_out)} · {reservation.nights ?? "-"} noches</p>
          <p className="mt-1 text-sm text-slate-500">Estado: {labelReservationStatus(reservation.status)} · Ingreso: {hasIncome ? "Ingreso creado" : "sin crear"} · Importe: {amountPending ? labelAmountStatus(reservation.income_amount_status) : `${formatCurrency(reservation.income_amount)} · ${labelAmountStatus(reservation.income_amount_status)}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => onCreateIncome(reservation.id, {})} className="bg-ink">{hasIncome ? "Ingreso creado" : "Crear ingreso"}</Button>
          <Button disabled={pending} onClick={() => onUpdateReservation(reservation.id, { status: "cancelled" })} className="bg-white text-coral hover:bg-slate-50">Cancelar</Button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
        <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" step="0.01" placeholder="Importe manual" className="h-10 rounded-md border border-slate-300 px-3" />
        <Button disabled={pending || !amount} onClick={() => onCreateIncome(reservation.id, { amount, amount_status: "manual" })} className="bg-meadow hover:bg-green-700">Completar importe</Button>
      </div>
    </Card>
  );
}

function ReservationCalendar({ reservations, month, onMonthChange }: { reservations: Reservation[]; month: Date; onMonthChange: (date: Date) => void }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, index) => index < startOffset ? null : new Date(month.getFullYear(), month.getMonth(), index - startOffset + 1));
  const todayKey = dateKey(new Date());
  const monthLabel = month.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold capitalize">{monthLabel}</h3>
        <div className="flex gap-2">
          <Button onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="bg-white text-ink hover:bg-slate-50">Anterior</Button>
          <Button onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="bg-white text-ink hover:bg-slate-50">Siguiente</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
        {["L", "M", "X", "J", "V", "S", "D"].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="aspect-square rounded-md bg-slate-50" />;
          const key = dateKey(day);
          const dayReservations = reservations.filter((reservation) => reservationCoversDate(reservation, day));
          const checkIn = reservations.some((reservation) => dateKey(new Date(reservation.check_in)) === key);
          const checkOut = reservations.some((reservation) => dateKey(new Date(reservation.check_out)) === key);
          return (
            <div key={key} className={`aspect-square rounded-md border p-2 text-xs ${dayReservations.length ? "border-meadow bg-emerald-50 text-ink" : "border-slate-200 bg-white"} ${key === todayKey ? "ring-2 ring-sun" : ""}`}>
              <p className="font-bold">{day.getDate()}</p>
              {checkIn && <p className="mt-1 text-[10px] text-meadow">Entrada</p>}
              {checkOut && <p className="text-[10px] text-coral">Salida</p>}
              {dayReservations.length > 0 && !checkIn && !checkOut && <p className="mt-1 text-[10px]">Reservado</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DriveConnectForm({
  folders,
  googleConnected,
  pending,
  loadingFolders,
  folderError,
  onLoadFolders,
  onSubmit
}: {
  folders: AvailableDriveFolder[];
  googleConnected: boolean;
  pending: boolean;
  loadingFolders: boolean;
  folderError: unknown;
  onLoadFolders: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [folderSearch, setFolderSearch] = useState("");
  const visibleFolders = folders.filter((folder) => folder.name.toLowerCase().includes(folderSearch.toLowerCase().trim()));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedFolderId = String(form.get("drive_folder_id") ?? "");
    const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);
    const manualFolder = String(form.get("folder_url") ?? "");
    onSubmit({
      folder_title: String(form.get("folder_title") ?? ""),
      folder_id: mode === "select" ? selectedFolderId : manualFolder,
      folder_url: mode === "select" ? selectedFolder?.webViewLink ?? "" : manualFolder,
      folder_type: String(form.get("folder_type") ?? "otros"),
      provider_hint: ""
    });
    event.currentTarget.reset();
    setFolderSearch("");
  }
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Titulo de la carpeta en Hogarflow</span>
          <input name="folder_title" required placeholder="Facturas" className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Tipo de carpeta</span>
          <select name="folder_type" className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow">
            {["facturas", "documentos", "seguros", "contratos", "ibi", "comunidad", "mantenimiento", "reservas", "otros"].map((item) => <option key={item} value={item}>{labelFolderType(item)}</option>)}
          </select>
        </label>
      </div>

      <div className="rounded-md border border-slate-200 p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("select")} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "select" ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>Buscar carpeta en Drive</button>
          <button type="button" onClick={() => setMode("manual")} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "manual" ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>Pegar URL o ID de carpeta</button>
        </div>
        {mode === "select" && (
          <div className="grid gap-3">
            {googleConnected && folders.length === 0 && (
              <Button type="button" disabled={loadingFolders} onClick={onLoadFolders} className="bg-white text-ink hover:bg-slate-50">
                {loadingFolders ? "Cargando carpetas..." : "Cargar carpetas de Drive"}
              </Button>
            )}
            {Boolean(folderError) && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">No se pudieron cargar carpetas de Drive. Revisa la autorizacion de Google y vuelve a intentarlo.</p>}
            {folders.length > 0 && (
              <>
                <input value={folderSearch} onChange={(event) => setFolderSearch(event.target.value)} placeholder="Buscar por nombre: Pastores, Facturas, Documentos..." className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
                <select name="drive_folder_id" required disabled={!googleConnected || visibleFolders.length === 0} className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow">
                  <option value="">{visibleFolders.length > 0 ? "Selecciona una carpeta de Drive" : "No hay carpetas con ese nombre"}</option>
                  {visibleFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </>
            )}
            {!googleConnected && <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">Autoriza Google Drive para buscar carpetas disponibles.</p>}
          </div>
        )}
        {mode === "manual" && (
          <input name="folder_url" required placeholder="URL o ID de carpeta Drive" className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
        )}
      </div>

      <Button disabled={pending || (mode === "select" && (!googleConnected || folders.length === 0))} className="bg-ink">Conectar carpeta</Button>
    </form>
  );
}

function DriveFolderCard({ folder, pending, onSync, onUpdate, onDelete }: { folder: DriveFolderMapping; pending: boolean; onSync: (folderId: string) => void; onUpdate: (folderId: string, data: Record<string, unknown>) => void; onDelete: (folderId: string) => void }) {
  const [folderType, setFolderType] = useState(folder.folder_type);
  const [syncEnabled, setSyncEnabled] = useState(folder.sync_enabled);
  const [editing, setEditing] = useState(false);
  const realFolderName = folder.metadata?.drive_folder_name ?? folder.drive_folder_name;
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">{folder.drive_folder_name}</p>
          <p className="text-sm text-slate-500">Carpeta Drive: {realFolderName}</p>
          <p className="text-sm text-slate-500">Tipo: {labelFolderType(folder.folder_type)} · Archivos: {folder.file_count ?? 0}</p>
          <p className="text-xs text-slate-500">Ultima sincronizacion: {formatDate(folder.last_sync_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || !folder.sync_enabled} onClick={() => onSync(folder.id)} className="bg-meadow hover:bg-green-700">Sincronizar</Button>
          <Button onClick={() => setEditing(!editing)} className="bg-ink">Editar</Button>
          <button onClick={() => onDelete(folder.id)} className="h-10 rounded-md border border-coral px-3 text-sm font-semibold text-coral">Desconectar</button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_140px_120px]">
          <select value={folderType} onChange={(event) => setFolderType(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            {["facturas", "documentos", "seguros", "contratos", "ibi", "comunidad", "mantenimiento", "reservas", "otros"].map((item) => <option key={item} value={item}>{labelFolderType(item)}</option>)}
          </select>
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm">
            <input type="checkbox" checked={syncEnabled} onChange={(event) => setSyncEnabled(event.target.checked)} />
            Activa
          </label>
          <Button onClick={() => onUpdate(folder.id, { folder_type: folderType, sync_enabled: syncEnabled })} className="bg-ink">Guardar</Button>
        </div>
      )}
    </div>
  );
}

function DriveFileCard({
  file,
  expenses,
  documents,
  pending,
  onUpdate,
  onLinkExpense,
  onLinkDocument,
  onRegisterExpense,
  onSaveDocument
}: {
  file: DriveFile;
  expenses: Expense[];
  documents: DocumentItem[];
  pending: boolean;
  onUpdate: (fileId: string, data: Record<string, unknown>) => void;
  onLinkExpense: (fileId: string, expenseId: string) => void;
  onLinkDocument: (fileId: string, documentId: string) => void;
  onRegisterExpense: (fileId: string, data: Record<string, unknown>) => void;
  onSaveDocument: (fileId: string, data: Record<string, unknown>) => void;
}) {
  const [expenseId, setExpenseId] = useState(file.linked_expense_id ?? "");
  const [documentId, setDocumentId] = useState(file.linked_document_id ?? "");
  const [mode, setMode] = useState<"none" | "expense" | "linkExpense" | "document" | "linkDocument">("none");
  const defaultDate = (file.modified_time ?? file.created_time ?? new Date().toISOString()).slice(0, 10);
  function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onRegisterExpense(file.id, {
      description: String(form.get("description") ?? file.name),
      expense_date: String(form.get("expense_date") ?? defaultDate),
      amount: String(form.get("amount") ?? ""),
      category: String(form.get("category") ?? "otros")
    });
  }
  function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSaveDocument(file.id, {
      title: String(form.get("title") ?? file.name),
      type: String(form.get("type") ?? "otro"),
      expiration_date: String(form.get("expiration_date") ?? ""),
      notes: String(form.get("notes") ?? "")
    });
  }
  return (
    <Card className={`border p-4 ${reviewStatusClasses(file.review_status)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{file.name}</p>
          <p className="text-sm text-slate-500">Tipo: {labelMimeType(file.mime_type)} · Carpeta: {file.source_folder_name ?? labelFolderType(file.folder_type)} · Modificado: {formatDate(file.modified_time)}</p>
          <p className="mt-2 inline-flex rounded-md bg-white px-3 py-1 text-sm font-semibold">Estado: {labelReviewStatus(file.review_status)}</p>
          {(file.linked_expense_description || file.linked_document_title) && (
            <p className="mt-2 text-sm text-slate-600">Asociado a: {file.linked_expense_description ?? file.linked_document_title}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {file.web_view_link && (
            <a href={file.web_view_link} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white">
              <ExternalLink className="h-4 w-4" />
              Abrir en Drive
            </a>
          )}
          <Button disabled={pending} onClick={() => setMode(mode === "expense" ? "none" : "expense")} className="bg-meadow hover:bg-green-700">Registrar como gasto</Button>
          <Button disabled={pending} onClick={() => setMode(mode === "document" ? "none" : "document")} className="bg-white text-ink hover:bg-slate-50">Guardar como documento</Button>
          <Button disabled={pending} onClick={() => onUpdate(file.id, { review_status: "reviewed" })} className="bg-white text-ink hover:bg-slate-50">Marcar revisado</Button>
          <Button disabled={pending} onClick={() => onUpdate(file.id, { review_status: "ignored" })} className="bg-white text-slate-600 hover:bg-slate-50">Ignorar</Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setMode(mode === "linkExpense" ? "none" : "linkExpense")} className="text-sm font-semibold text-meadow">Asociar a gasto existente</button>
        <button onClick={() => setMode(mode === "linkDocument" ? "none" : "linkDocument")} className="text-sm font-semibold text-meadow">Asociar a documento existente</button>
      </div>

      {mode === "expense" && (
        <form onSubmit={submitExpense} className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Concepto</span>
            <input name="description" defaultValue={file.name} required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Fecha</span>
            <input name="expense_date" type="date" defaultValue={defaultDate} required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Importe</span>
            <input name="amount" type="number" step="0.01" required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Categoria general</span>
            <select name="category" defaultValue="otros" className="h-10 w-full rounded-md border border-slate-300 px-3">
              {expenseInboxCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <Button disabled={pending} className="bg-meadow hover:bg-green-700 md:col-span-2">Guardar gasto</Button>
        </form>
      )}

      {mode === "document" && (
        <form onSubmit={submitDocument} className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Titulo</span>
            <input name="title" defaultValue={file.name} required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tipo de documento</span>
            <select name="type" defaultValue="otro" className="h-10 w-full rounded-md border border-slate-300 px-3">
              {documentInboxTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Vencimiento opcional</span>
            <input name="expiration_date" type="date" className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Notas</span>
            <input name="notes" className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <Button disabled={pending} className="bg-meadow hover:bg-green-700 md:col-span-2">Guardar documento</Button>
        </form>
      )}

      {mode === "linkExpense" && (
        <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px]">
          <select value={expenseId} onChange={(event) => setExpenseId(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            <option value="">Selecciona gasto de esta vivienda</option>
            {expenses.map((expense) => <option key={expense.id} value={expense.id}>{formatDate(expense.expense_date)} · {expense.description ?? expense.category} · {formatCurrency(expense.amount)}</option>)}
          </select>
          <Button disabled={!expenseId || pending} onClick={() => onLinkExpense(file.id, expenseId)} className="bg-ink">Asociar gasto</Button>
        </div>
      )}

      {mode === "linkDocument" && (
        <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px]">
          <select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            <option value="">Selecciona documento de esta vivienda</option>
            {documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
          </select>
          <Button disabled={!documentId || pending} onClick={() => onLinkDocument(file.id, documentId)} className="bg-ink">Asociar documento</Button>
        </div>
      )}
    </Card>
  );
}

const expenseInboxCategories = [
  { value: "suministros", label: "Suministros" },
  { value: "comunidad", label: "Comunidad" },
  { value: "seguro", label: "Seguro" },
  { value: "impuestos", label: "Impuestos" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "reforma", label: "Reforma" },
  { value: "limpieza", label: "Limpieza" },
  { value: "mobiliario", label: "Mobiliario" },
  { value: "hipoteca", label: "Hipoteca" },
  { value: "otros", label: "Otros" }
];

const documentInboxTypes = [
  { value: "contrato", label: "Contrato" },
  { value: "seguro", label: "Seguro" },
  { value: "IBI", label: "IBI" },
  { value: "comunidad", label: "Comunidad" },
  { value: "certificado", label: "Certificado" },
  { value: "garantia", label: "Garantia" },
  { value: "manual", label: "Manual" },
  { value: "otro", label: "Otro" }
];

function reviewStatusClasses(value?: string | null) {
  const classes: Record<string, string> = {
    pending_review: "border-amber-200 bg-amber-50",
    registered: "border-emerald-200 bg-emerald-50",
    linked: "border-emerald-200 bg-emerald-50",
    reviewed: "border-sky-200 bg-sky-50",
    ignored: "border-slate-200 bg-slate-50"
  };
  return classes[String(value ?? "pending_review")] ?? classes.pending_review;
}

function labelFolderType(value?: string | null) {
  const labels: Record<string, string> = {
    facturas: "Facturas",
    documentos: "Documentos",
    seguros: "Seguros",
    contratos: "Contratos",
    ibi: "IBI",
    comunidad: "Comunidad",
    mantenimiento: "Mantenimiento",
    reservas: "Reservas",
    otros: "Otros"
  };
  return labels[String(value ?? "otros")] ?? "Otros";
}

function labelReviewStatus(value?: string | null) {
  const labels: Record<string, string> = {
    pending_review: "Pendiente",
    registered: "Registrado",
    reviewed: "Revisado",
    linked: "Asociado",
    ignored: "Ignorado"
  };
  return labels[String(value ?? "pending_review")] ?? "Pendiente";
}

function labelDocumentType(value?: string | null) {
  const labels: Record<string, string> = {
    factura: "Factura",
    contrato: "Contrato",
    seguro: "Seguro",
    ibi: "IBI",
    comunidad: "Comunidad",
    mantenimiento: "Mantenimiento",
    reserva: "Reserva",
    otro: "Otro"
  };
  return labels[String(value ?? "")] ?? "Sin clasificar";
}

function labelMimeType(value?: string | null) {
  const mime = String(value ?? "").toLowerCase();
  if (mime.includes("pdf")) return "PDF";
  if (mime.startsWith("image/")) return "Imagen";
  if (mime.includes("document") || mime.includes("word") || mime.includes("text")) return "Documento";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "Hoja de calculo";
  return "Archivo";
}

function labelDriveFilter(value: string) {
  const labels: Record<string, string> = {
    todos: "Todos",
    pending_review: "Pendientes",
    registered: "Registrados",
    reviewed: "Revisados",
    linked: "Asociados",
    ignored: "Ignorados"
  };
  return labels[value] ?? value;
}

function labelOperationType(value?: string | null) {
  const labels: Record<string, string> = {
    tourist: "Turistica",
    long_term: "Larga estancia",
    own_use: "Uso propio",
    mixed: "Mixta",
    inactive: "Inactiva",
    airbnb: "Turistica"
  };
  return labels[String(value ?? "mixed")] ?? "Mixta";
}

function labelReservationStatus(value?: string | null) {
  const labels: Record<string, string> = {
    confirmed: "Confirmada",
    cancelled: "Cancelada",
    blocked: "Bloqueada",
    removed_from_calendar: "Ya no aparece en iCal"
  };
  return labels[String(value ?? "confirmed")] ?? "Confirmada";
}

function labelAmountStatus(value?: string | null) {
  const labels: Record<string, string> = {
    missing: "Pendiente importe",
    manual: "Manual",
    estimated: "Estimado",
    confirmed: "Confirmado"
  };
  return labels[String(value ?? "missing")] ?? "Pendiente importe";
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function reservationCoversDate(reservation: Reservation, day: Date) {
  if (reservation.status === "cancelled" || reservation.status === "removed_from_calendar") return false;
  const start = new Date(reservation.check_in);
  const end = new Date(reservation.check_out);
  const current = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return current >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) && current < new Date(end.getFullYear(), end.getMonth(), end.getDate());
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-md bg-emerald-50 text-meadow">{icon}</div>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </Card>
  );
}

function Row({ title, subtitle, amount }: { title: string; subtitle: string; amount: number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="truncate text-sm text-slate-500">{subtitle}</p>
      </div>
      <p className="font-bold">{formatCurrency(amount)}</p>
    </div>
  );
}

function ExpenseForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  return <SimpleForm title="Nuevo gasto" pending={pending} fields={["provider", "amount", "expense_date", "description"]} labels={["Proveedor", "Importe", "Fecha", "Descripcion"]} defaults={{ category: "other" }} onSubmit={onSubmit} />;
}

function IncomeForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  return <SimpleForm title="Nuevo ingreso" pending={pending} fields={["guest_name", "amount", "income_date", "check_in", "check_out", "nights"]} labels={["Huesped", "Importe", "Fecha ingreso", "Entrada", "Salida", "Noches"]} defaults={{ source: "airbnb" }} onSubmit={onSubmit} />;
}

function DocumentForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  return <SimpleForm title="Nuevo documento" pending={pending} fields={["title", "provider", "cost", "expiration_date"]} labels={["Titulo", "Proveedor", "Coste", "Caducidad"]} defaults={{ type: "other" }} onSubmit={onSubmit} />;
}

function SimpleForm({ title, fields, labels, defaults, pending, onSubmit }: { title: string; fields: string[]; labels: string[]; defaults: Record<string, unknown>; pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data: Record<string, unknown> = { ...defaults };
    fields.forEach((field) => {
      const value = String(form.get(field) ?? "");
      data[field] = ["amount", "cost"].includes(field) ? Number(value) : field === "nights" ? Number(value || 0) : value;
    });
    onSubmit(data);
    event.currentTarget.reset();
  }
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold">{title}</h3>
      <form onSubmit={submit} className="space-y-3">
        {fields.map((field, index) => (
          <label key={field} className="block">
            <span className="mb-1 block text-sm font-medium">{labels[index]}</span>
            <input name={field} type={field.includes("date") || field.includes("expiration") || field.includes("check_") ? "date" : ["amount", "cost", "nights"].includes(field) ? "number" : "text"} step="0.01" required className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
          </label>
        ))}
        <Button disabled={pending} className="w-full bg-meadow hover:bg-green-700"><Plus className="h-4 w-4" />Crear</Button>
      </form>
    </Card>
  );
}
