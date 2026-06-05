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
  deleteDriveFolder,
  getAvailableDriveFolders,
  getProperty,
  getPropertyDocuments,
  getPropertyDrive,
  getPropertyDriveAuthUrl,
  getPropertyExpenses,
  getPropertyIncome,
  linkDriveFileDocument,
  linkDriveFileExpense,
  syncAllPropertyDrive,
  syncDriveFolder,
  syncPropertyDrive,
  updateDriveFile,
  updateDriveFolder
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AvailableDriveFolder, DocumentItem, DriveFile, DriveFolderMapping, DriveState, Expense, Income, Property } from "@/types";

const tabs = ["Resumen", "Ingresos", "Gastos", "Documentos", "Drive", "Estadisticas"] as const;
type Tab = (typeof tabs)[number];

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const propertyId = params.id;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "Drive" ? "Drive" : "Resumen");
  const { data: property } = useQuery<Property>({ queryKey: ["property", propertyId], queryFn: () => getProperty(propertyId) });
  const { data: income = [] } = useQuery<Income[]>({ queryKey: ["property-income", propertyId], queryFn: () => getPropertyIncome(propertyId) });
  const { data: expenses = [] } = useQuery<Expense[]>({ queryKey: ["property-expenses", propertyId], queryFn: () => getPropertyExpenses(propertyId) });
  const { data: documents = [] } = useQuery<DocumentItem[]>({ queryKey: ["property-documents", propertyId], queryFn: () => getPropertyDocuments(propertyId) });
  const { data: drive } = useQuery<DriveState>({ queryKey: ["property-drive", propertyId], queryFn: () => getPropertyDrive(propertyId) });
  const { data: availableDriveFolders = [] } = useQuery<AvailableDriveFolder[]>({
    queryKey: ["property-drive-available-folders", propertyId, drive?.google_connected],
    queryFn: () => getAvailableDriveFolders(propertyId),
    enabled: Boolean(drive?.google_connected)
  });
  const totals = useMemo(() => {
    const totalIncome = income.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    return { totalIncome, totalExpenses, profit: totalIncome - totalExpenses };
  }, [income, expenses]);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["property-income", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-expenses", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["properties"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const expenseMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createPropertyExpense(propertyId, data), onSuccess: refresh });
  const incomeMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createPropertyIncome(propertyId, data), onSuccess: refresh });
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

  if (!property) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/properties" className="text-sm font-semibold text-meadow">Volver a viviendas</Link>
          <h2 className="mt-1 text-2xl font-bold">{property.alias}</h2>
          <p className="text-sm text-slate-500">{property.address}</p>
        </div>
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

      {tab === "Documentos" && (
        <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <DocumentForm pending={documentMutation.isPending} onSubmit={(data) => documentMutation.mutate(data)} />
          <div className="grid gap-3">
            {documents.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.title}</p>
                    <p className="text-sm text-slate-500">{item.provider ?? item.type} Â· caduca {formatDate(item.expiration_date)}</p>
                  </div>
                  <p className="font-bold">{formatCurrency(item.cost)}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {tab === "Drive" && drive && (
        <DrivePanel
          drive={drive}
          availableDriveFolders={availableDriveFolders}
          googleStatus={searchParams.get("google")}
          expenses={expenses}
          documents={documents}
          pendingConnect={driveFolderCreateMutation.isPending}
          pendingAuthorize={driveAuthorizeMutation.isPending}
          pendingSync={driveSyncMutation.isPending || driveSyncAllMutation.isPending || driveFolderSyncMutation.isPending}
          pendingUpdate={driveUpdateMutation.isPending || driveLinkExpenseMutation.isPending || driveLinkDocumentMutation.isPending}
          onAuthorize={() => driveAuthorizeMutation.mutate()}
          onCreateFolder={(data) => driveFolderCreateMutation.mutate(data)}
          onUpdateFolder={(folderId, data) => driveFolderUpdateMutation.mutate({ folderId, data })}
          onDeleteFolder={(folderId) => driveFolderDeleteMutation.mutate(folderId)}
          onSyncFolder={(folderId) => driveFolderSyncMutation.mutate(folderId)}
          onSyncAll={() => driveSyncAllMutation.mutate()}
          onSync={() => driveSyncMutation.mutate()}
          onUpdate={(fileId, data) => driveUpdateMutation.mutate({ fileId, data })}
          onLinkExpense={(fileId, expenseId) => driveLinkExpenseMutation.mutate({ fileId, expenseId })}
          onLinkDocument={(fileId, documentId) => driveLinkDocumentMutation.mutate({ fileId, documentId })}
        />
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
  googleStatus,
  expenses,
  documents,
  pendingConnect,
  pendingAuthorize,
  pendingSync,
  pendingUpdate,
  onAuthorize,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onSyncFolder,
  onSyncAll,
  onSync,
  onUpdate,
  onLinkExpense,
  onLinkDocument
}: {
  drive: DriveState;
  availableDriveFolders: AvailableDriveFolder[];
  googleStatus: string | null;
  expenses: Expense[];
  documents: DocumentItem[];
  pendingConnect: boolean;
  pendingAuthorize: boolean;
  pendingSync: boolean;
  pendingUpdate: boolean;
  onAuthorize: () => void;
  onCreateFolder: (data: Record<string, unknown>) => void;
  onUpdateFolder: (folderId: string, data: Record<string, unknown>) => void;
  onDeleteFolder: (folderId: string) => void;
  onSyncFolder: (folderId: string) => void;
  onSyncAll: () => void;
  onSync: () => void;
  onUpdate: (fileId: string, data: Record<string, unknown>) => void;
  onLinkExpense: (fileId: string, expenseId: string) => void;
  onLinkDocument: (fileId: string, documentId: string) => void;
}) {
  const [filter, setFilter] = useState("todos");
  const [folderFilter, setFolderFilter] = useState("todos");
  const filtered = drive.files.filter((file) => {
    if (folderFilter !== "todos" && file.drive_folder_mapping_id !== folderFilter) return false;
    if (filter === "todos") return true;
    if (filter === "sin_clasificar") return !file.document_type;
    if (filter === "vencimientos") return Boolean(file.expiration_date);
    if (filter === "sin_vincular") return !file.linked_expense_id && !file.linked_document_id;
    if (["pending_review", "reviewed", "linked", "ignored"].includes(filter)) return file.review_status === filter;
    return file.folder_type === filter || file.document_type === filter;
  });

  return (
    <section className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Carpetas conectadas de Google Drive</h3>
            <p className="text-sm text-slate-500">{drive.folders.length > 0 ? `${drive.folders.length} carpetas conectadas` : "Todavia no has conectado ninguna carpeta de Drive para esta vivienda."}</p>
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
        <DriveConnectForm folders={availableDriveFolders} googleConnected={Boolean(drive.google_connected)} pending={pendingConnect} onSubmit={onCreateFolder} />
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

      <div className="grid gap-2 md:grid-cols-2">
        <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
          <option value="todos">Todas las carpetas</option>
          {drive.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.drive_folder_name}</option>)}
        </select>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
          {["todos", "facturas", "documentos", "contratos", "seguros", "pending_review", "reviewed", "linked", "ignored", "vencimientos", "sin_clasificar", "sin_vincular"].map((item) => (
            <option key={item} value={item}>{labelDriveFilter(item)}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3">
        {filtered.map((file) => (
          <DriveFileCard key={file.id} file={file} expenses={expenses} documents={documents} pending={pendingUpdate} onUpdate={onUpdate} onLinkExpense={onLinkExpense} onLinkDocument={onLinkDocument} />
        ))}
        {filtered.length === 0 && <Card className="p-5 text-sm text-slate-500">No hay archivos para este filtro.</Card>}
      </div>
    </section>
  );
}

function DriveConnectForm({ folders, googleConnected, pending, onSubmit }: { folders: AvailableDriveFolder[]; googleConnected: boolean; pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      provider_hint: String(form.get("provider_hint") ?? "")
    });
    event.currentTarget.reset();
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
          <select name="drive_folder_id" required disabled={!googleConnected || folders.length === 0} className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow">
            <option value="">{googleConnected ? "Selecciona una carpeta de Drive" : "Autoriza Google Drive para ver carpetas"}</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        )}
        {mode === "manual" && (
          <input name="folder_url" required placeholder="URL o ID de carpeta Drive" className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
        )}
      </div>

      <div>
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm font-semibold text-meadow">
          {showAdvanced ? "Ocultar opciones avanzadas" : "Opciones avanzadas"}
        </button>
        {showAdvanced && (
          <label className="mt-2 block">
            <span className="mb-1 block text-sm font-medium">Proveedor / compania</span>
            <input name="provider_hint" placeholder="Iberdrola, Movistar, Comunidad..." className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
          </label>
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

function DriveFileCard({ file, expenses, documents, pending, onUpdate, onLinkExpense, onLinkDocument }: { file: DriveFile; expenses: Expense[]; documents: DocumentItem[]; pending: boolean; onUpdate: (fileId: string, data: Record<string, unknown>) => void; onLinkExpense: (fileId: string, expenseId: string) => void; onLinkDocument: (fileId: string, documentId: string) => void }) {
  const [documentType, setDocumentType] = useState(file.document_type ?? "");
  const [expirationDate, setExpirationDate] = useState(file.expiration_date ?? "");
  const [reviewStatus, setReviewStatus] = useState<string>(file.review_status ?? "pending_review");
  const [expenseId, setExpenseId] = useState(file.linked_expense_id ?? "");
  const [documentId, setDocumentId] = useState(file.linked_document_id ?? "");
  const [editing, setEditing] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{file.name}</p>
          <p className="text-sm text-slate-500">Tipo: {labelMimeType(file.mime_type)} · Carpeta: {file.source_folder_name ?? labelFolderType(file.folder_type)} · Modificado: {formatDate(file.modified_time)}</p>
          <p className="mt-1 text-sm text-slate-500">Estado: {labelReviewStatus(file.review_status)} · Clasificacion: {labelDocumentType(file.document_type)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {file.web_view_link && (
            <a href={file.web_view_link} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white">
              <ExternalLink className="h-4 w-4" />
              Abrir en Drive
            </a>
          )}
          <Button disabled={pending} onClick={() => onUpdate(file.id, { review_status: "reviewed" })} className="bg-meadow hover:bg-green-700">Marcar revisado</Button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px]">
        <select value={expenseId} onChange={(event) => setExpenseId(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
          <option value="">Asociar a gasto</option>
          {expenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.provider ?? expense.description ?? expense.category} · {formatCurrency(expense.amount)}</option>)}
        </select>
        <Button disabled={!expenseId || pending} onClick={() => onLinkExpense(file.id, expenseId)} className="bg-ink">Asociar a gasto</Button>
      </div>
      <button onClick={() => setEditing(!editing)} className="mt-3 text-sm font-semibold text-meadow">{editing ? "Ocultar detalles" : "Editar detalles"}</button>
      {editing && (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_120px]">
          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            <option value="">Sin clasificar</option>
            {["factura", "contrato", "seguro", "ibi", "comunidad", "mantenimiento", "reserva", "otro"].map((item) => <option key={item} value={item}>{labelDocumentType(item)}</option>)}
          </select>
          <input type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3" />
          <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            {["pending_review", "reviewed", "linked", "ignored"].map((item) => <option key={item} value={item}>{labelReviewStatus(item)}</option>)}
          </select>
          <Button disabled={pending} onClick={() => onUpdate(file.id, { document_type: documentType, expiration_date: expirationDate, review_status: reviewStatus })} className="bg-meadow hover:bg-green-700">Guardar</Button>
        </div>
      )}
      {editing && (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px]">
        <select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
          <option value="">Asociar a documento</option>
          {documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
        </select>
        <Button disabled={!documentId || pending} onClick={() => onLinkDocument(file.id, documentId)} className="bg-ink">Asociar</Button>
        </div>
      )}
    </Card>
  );
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
    todos: "Todos los archivos",
    facturas: "Facturas",
    documentos: "Documentos",
    contratos: "Contratos",
    seguros: "Seguros",
    pending_review: "Pendientes",
    reviewed: "Revisados",
    linked: "Asociados",
    ignored: "Ignorados",
    vencimientos: "Con vencimiento",
    sin_clasificar: "Sin clasificar",
    sin_vincular: "Sin asociar"
  };
  return labels[value] ?? value;
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



