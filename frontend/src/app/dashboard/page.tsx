"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Euro, Percent, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { getDashboard } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DashboardSummary } from "@/types";

export default function DashboardPage() {
  const { data } = useQuery<DashboardSummary>({ queryKey: ["dashboard"], queryFn: getDashboard });
  if (!data) return null;
  const kpis = [
    { label: "Beneficio neto global", value: formatCurrency(data.kpis.net_profit_month), icon: Euro, tone: "text-meadow bg-emerald-50" },
    { label: "Ocupacion media", value: `${data.kpis.average_occupancy}%`, icon: Percent, tone: "text-blue-700 bg-blue-50" },
    { label: "Vencimientos activos", value: String(data.kpis.upcoming_expirations), icon: CalendarClock, tone: "text-coral bg-rose-50" },
    { label: "ROI acumulado", value: `${data.kpis.accumulated_roi.toFixed(1)}%`, icon: TrendingUp, tone: "text-sun bg-amber-50" }
  ];
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-5">
              <div className={`mb-4 grid h-11 w-11 place-items-center rounded-md ${kpi.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-500">{kpi.label}</p>
              <p className="mt-2 text-2xl font-bold">{kpi.value}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold">Agregado mensual</h2>
            <span className="text-sm text-slate-500">Todas las viviendas</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area dataKey="ingresos" stroke="#15803d" fill="#dcfce7" strokeWidth={2} />
                <Area dataKey="gastos" stroke="#e11d48" fill="#ffe4e6" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">Alertas globales</h2>
          <div className="space-y-3">
            {data.alerts.map((alert) => (
              <div key={alert.id} className="flex gap-3 rounded-md border border-slate-200 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-sun" />
                <div>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="text-sm text-slate-500">{alert.property_alias} · {alert.days_to_expire} dias</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">Ranking de viviendas</h2>
          <div className="space-y-3">
            {data.properties
              .slice()
              .sort((a, b) => Number(b.month_profit ?? 0) - Number(a.month_profit ?? 0))
              .map((property) => (
                <Link key={property.id} href={`/properties/${property.id}`} className="block rounded-md border border-slate-200 p-4 transition hover:border-meadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{property.alias}</p>
                      <p className="text-sm text-slate-500">{property.address}</p>
                    </div>
                    <p className="font-bold text-meadow">{formatCurrency(property.month_profit)}</p>
                  </div>
                </Link>
              ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">Ultimos movimientos</h2>
          <div className="space-y-3">
            {(data.latest_movements ?? []).map((movement) => (
              <div key={`${movement.kind}-${movement.id}`} className="rounded-md border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{movement.kind} · {movement.property_alias}</p>
                    <p className="text-sm text-slate-500">{movement.guest_name ?? movement.provider ?? movement.description ?? "Movimiento"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(movement.amount)}</p>
                    <p className="text-xs text-slate-500">{formatDate(movement.movement_date)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">Proximas reservas</h2>
          <div className="space-y-3">
            {(data.upcoming_reservations ?? []).map((reservation) => (
              <Link key={reservation.id} href={`/properties/${reservation.property_id}`} className="block rounded-md border border-slate-200 p-4 transition hover:border-meadow">
                <p className="font-semibold">{reservation.property_alias ?? "Vivienda"}</p>
                <p className="text-sm text-slate-500">{reservation.guest_name ?? reservation.title ?? "Reserva"} · {formatDate(reservation.check_in)} - {formatDate(reservation.check_out)}</p>
              </Link>
            ))}
            {(data.upcoming_reservations ?? []).length === 0 && <p className="text-sm text-slate-500">Sin próximas reservas.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">Importes pendientes</h2>
          <div className="space-y-3">
            {(data.incomes_missing_amount ?? []).map((reservation) => (
              <Link key={reservation.id} href={`/properties/${reservation.property_id}`} className="block rounded-md border border-slate-200 p-4 transition hover:border-meadow">
                <p className="font-semibold">{reservation.property_alias ?? "Vivienda"}</p>
                <p className="text-sm text-slate-500">{reservation.guest_name ?? reservation.title ?? "Reserva"} · pendiente de importe</p>
              </Link>
            ))}
            {(data.incomes_missing_amount ?? []).length === 0 && <p className="text-sm text-slate-500">No hay importes pendientes.</p>}
          </div>
        </Card>
      </section>
    </div>
  );
}
