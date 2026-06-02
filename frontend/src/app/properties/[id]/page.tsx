"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FileText, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createPropertyDocument,
  createPropertyExpense,
  createPropertyIncome,
  getProperty,
  getPropertyDocuments,
  getPropertyExpenses,
  getPropertyIncome
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DocumentItem, Expense, Income, Property } from "@/types";

const tabs = ["Resumen", "Ingresos", "Gastos", "Documentos", "Estadisticas"] as const;
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

      {tab === "Estadisticas" && (
        <section className="grid gap-4 md:grid-cols-2">
          <Metric title="ROI estimado" value={`${(((totals.profit || 0) / (Number(property.initial_investment ?? 0) + Number(property.reform_cost ?? 0) || 1)) * 100).toFixed(2)}%`} icon={<Wallet className="h-5 w-5" />} />
          <Metric title="Documentos activos" value={String(documents.length)} icon={<FileText className="h-5 w-5" />} />
        </section>
      )}
    </div>
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
