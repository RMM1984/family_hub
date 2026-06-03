"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, FileText, FolderSync, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createPropertyDocument,
  createPropertyExpense,
  createPropertyIncome,
  connectPropertyDrive,
  getProperty,
  getPropertyDocuments,
  getPropertyDrive,
  getPropertyExpenses,
  getPropertyIncome,
  linkDriveFileDocument,
  linkDriveFileExpense,
  syncPropertyDrive,
  updateDriveFile
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DocumentItem, DriveFile, DriveState, Expense, Income, Property } from "@/types";

const tabs = ["Resumen", "Ingresos", "Gastos", "Documentos", "Drive", "Estadisticas"] as const;
type Tab = (typeof tabs)[number];

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const propertyId = params.id;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Resumen");
  const { data: property } = useQuery<Property>({ queryKey: ["property", propertyId], queryFn: () => getProperty(propertyId) });
  const { data: income = [] } = useQuery<Income[]>({ queryKey: ["property-income", propertyId], queryFn: () => getPropertyIncome(propertyId) });
  const { data: expenses = [] } = useQuery<Expense[]>({ queryKey: ["property-expenses", propertyId], queryFn: () => getPropertyExpenses(propertyId) });
  const { data: documents = [] } = useQuery<DocumentItem[]>({ queryKey: ["property-documents", propertyId], queryFn: () => getPropertyDocuments(propertyId) });
  const { data: drive } = useQuery<DriveState>({ queryKey: ["property-drive", propertyId], queryFn: () => getPropertyDrive(propertyId) });
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
  const driveConnectMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => connectPropertyDrive(propertyId, data), onSuccess: refreshDrive });
  const driveSyncMutation = useMutation({ mutationFn: () => syncPropertyDrive(propertyId), onSuccess: refreshDrive });
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
              <p className="rounded-md bg-slate-100 p-3 text-sm">Documento: <b>{documents[0]?.title ?? "Sin documentos"}</b> · {formatDate(documents[0]?.expiration_date)}</p>
              <p className="rounded-md bg-slate-100 p-3 text-sm">Reserva: <b>{income[0]?.guest_name ?? "Sin reservas"}</b> · {formatDate(income[0]?.check_in)}</p>
            </div>
          </Card>
        </section>
      )}

      {tab === "Ingresos" && (
        <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <IncomeForm pending={incomeMutation.isPending} onSubmit={(data) => incomeMutation.mutate(data)} />
          <Card className="overflow-hidden">
            {income.map((item) => (
              <Row key={item.id} title={item.guest_name ?? "Reserva"} subtitle={`${formatDate(item.check_in)} - ${formatDate(item.check_out)} · ${item.nights ?? "-"} noches`} amount={item.amount} />
            ))}
          </Card>
        </section>
      )}

      {tab === "Gastos" && (
        <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <ExpenseForm pending={expenseMutation.isPending} onSubmit={(data) => expenseMutation.mutate(data)} />
          <Card className="overflow-hidden">
            {expenses.map((item) => (
              <Row key={item.id} title={item.provider ?? item.category} subtitle={`${item.description ?? "Gasto"} · ${formatDate(item.expense_date)}`} amount={item.amount} />
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
                    <p className="text-sm text-slate-500">{item.provider ?? item.type} · caduca {formatDate(item.expiration_date)}</p>
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
          expenses={expenses}
          documents={documents}
          pendingConnect={driveConnectMutation.isPending}
          pendingSync={driveSyncMutation.isPending}
          pendingUpdate={driveUpdateMutation.isPending || driveLinkExpenseMutation.isPending || driveLinkDocumentMutation.isPending}
          onConnect={(data) => driveConnectMutation.mutate(data)}
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
  expenses,
  documents,
  pendingConnect,
  pendingSync,
  pendingUpdate,
  onConnect,
  onSync,
  onUpdate,
  onLinkExpense,
  onLinkDocument
}: {
  drive: DriveState;
  expenses: Expense[];
  documents: DocumentItem[];
  pendingConnect: boolean;
  pendingSync: boolean;
  pendingUpdate: boolean;
  onConnect: (data: Record<string, unknown>) => void;
  onSync: () => void;
  onUpdate: (fileId: string, data: Record<string, unknown>) => void;
  onLinkExpense: (fileId: string, expenseId: string) => void;
  onLinkDocument: (fileId: string, documentId: string) => void;
}) {
  const [filter, setFilter] = useState("todos");
  const filtered = drive.files.filter((file) => {
    if (filter === "todos") return true;
    if (filter === "sin_clasificar") return !file.document_type;
    if (filter === "vencimientos") return Boolean(file.expiration_date);
    return file.document_type === filter;
  });
  return (
    <section className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Documentos Drive</h3>
            <p className="text-sm text-slate-500">
              {drive.integration ? `Conectado a ${drive.integration.folder_name ?? drive.integration.folder_id}` : "Sin carpeta conectada"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Scope: {drive.scope}</p>
          </div>
          <Button disabled={!drive.integration || pendingSync} onClick={onSync} className="bg-meadow hover:bg-green-700">
            <FolderSync className="h-4 w-4" />
            Sincronizar
          </Button>
        </div>
        {!drive.google_configured && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-sun">Google Drive no esta configurado en Railway. Puedes vincular la carpeta ahora; la sincronizacion requerira variables OAuth y token autorizado.</p>
        )}
        <DriveConnectForm pending={pendingConnect} onSubmit={onConnect} />
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["todos", "factura", "contrato", "seguro", "ibi", "comunidad", "mantenimiento", "reserva", "vencimientos", "sin_clasificar"].map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`h-9 whitespace-nowrap rounded-md px-3 text-sm font-semibold ${filter === item ? "bg-ink text-white" : "bg-white text-slate-600"}`}>
            {item.replace("_", " ")}
          </button>
        ))}
      </div>

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
          />
        ))}
        {filtered.length === 0 && <Card className="p-5 text-sm text-slate-500">No hay archivos para este filtro.</Card>}
      </div>
    </section>
  );
}

function DriveConnectForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      folder_url: String(form.get("folder_url") ?? ""),
      folder_name: String(form.get("folder_name") ?? ""),
      access_token: String(form.get("access_token") ?? "")
    });
    event.currentTarget.reset();
  }
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px]">
      <input name="folder_url" required placeholder="URL o ID de carpeta Drive" className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
      <input name="folder_name" placeholder="Nombre visible" className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
      <input name="access_token" placeholder="Access token OAuth opcional" className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-meadow lg:col-span-2" />
      <Button disabled={pending} className="bg-ink lg:col-span-2">Conectar carpeta Drive</Button>
    </form>
  );
}

function DriveFileCard({ file, expenses, documents, pending, onUpdate, onLinkExpense, onLinkDocument }: { file: DriveFile; expenses: Expense[]; documents: DocumentItem[]; pending: boolean; onUpdate: (fileId: string, data: Record<string, unknown>) => void; onLinkExpense: (fileId: string, expenseId: string) => void; onLinkDocument: (fileId: string, documentId: string) => void }) {
  const [documentType, setDocumentType] = useState(file.document_type ?? "");
  const [expirationDate, setExpirationDate] = useState(file.expiration_date ?? "");
  const [expenseId, setExpenseId] = useState(file.linked_expense_id ?? "");
  const [documentId, setDocumentId] = useState(file.linked_document_id ?? "");
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{file.name}</p>
          <p className="text-sm text-slate-500">{file.mime_type ?? "Archivo"} · modificado {formatDate(file.modified_time)}</p>
          <p className="mt-1 text-sm text-slate-500">Clasificacion: {file.document_type ?? "Sin clasificar"} · vence {formatDate(file.expiration_date)}</p>
        </div>
        {file.web_view_link && (
          <a href={file.web_view_link} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white">
            <ExternalLink className="h-4 w-4" />
            Abrir en Drive
          </a>
        )}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
          <option value="">Sin clasificar</option>
          {["factura", "contrato", "seguro", "ibi", "comunidad", "mantenimiento", "reserva", "otro"].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3" />
        <Button disabled={pending} onClick={() => onUpdate(file.id, { document_type: documentType, expiration_date: expirationDate })} className="bg-meadow hover:bg-green-700">Guardar</Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_1fr_160px]">
        <select value={expenseId} onChange={(event) => setExpenseId(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
          <option value="">Asociar a gasto</option>
          {expenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.provider ?? expense.description ?? expense.category} · {formatCurrency(expense.amount)}</option>)}
        </select>
        <Button disabled={!expenseId || pending} onClick={() => onLinkExpense(file.id, expenseId)} className="bg-ink">Asociar</Button>
        <select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
          <option value="">Asociar a documento</option>
          {documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
        </select>
        <Button disabled={!documentId || pending} onClick={() => onLinkDocument(file.id, documentId)} className="bg-ink">Asociar</Button>
      </div>
    </Card>
  );
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
