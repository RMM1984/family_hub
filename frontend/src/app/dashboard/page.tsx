"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Euro, Percent, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { getDashboard } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { DashboardSummary } from "@/types";

export default function DashboardPage() {
  const { data } = useQuery<DashboardSummary>({ queryKey: ["dashboard"], queryFn: getDashboard });
  if (!data) return null;
  const kpis = [
    { label: "Beneficio neto del mes", value: formatCurrency(data.kpis.net_profit_month), icon: Euro, tone: "text-meadow bg-emerald-50" },
    { label: "Ocupacion media", value: `${data.kpis.average_occupancy}%`, icon: Percent, tone: "text-blue-700 bg-blue-50" },
    { label: "Proximos vencimientos", value: String(data.kpis.upcoming_expirations), icon: CalendarClock, tone: "text-coral bg-rose-50" },
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
      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold">Ingresos vs gastos</h2>
            <span className="text-sm text-slate-500">Ultimos 12 meses</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id="income" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#15803d" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#15803d" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenses" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area dataKey="ingresos" stroke="#15803d" fill="url(#income)" strokeWidth={2} />
                <Area dataKey="gastos" stroke="#e11d48" fill="url(#expenses)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">Alertas activas</h2>
          <div className="space-y-3">
            {data.alerts.map((alert) => (
              <div key={alert.id} className="flex gap-3 rounded-md border border-slate-200 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-sun" />
                <div>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="text-sm text-slate-500">Caduca en {alert.days_to_expire} dias</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {data.properties.map((property) => (
          <Card key={property.id} className="p-5">
            <p className="text-sm text-slate-500">{property.address}</p>
            <h3 className="mt-1 text-xl font-bold">{property.alias}</h3>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <span className="rounded-md bg-slate-100 p-3">Ingresos<br /><b>{formatCurrency(1280)}</b></span>
              <span className="rounded-md bg-slate-100 p-3">Gastos<br /><b>{formatCurrency(360)}</b></span>
              <span className="rounded-md bg-slate-100 p-3">Ocupacion<br /><b>71%</b></span>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
