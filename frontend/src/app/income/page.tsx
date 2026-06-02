"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarSync, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getIncome } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Income } from "@/types";

export default function IncomePage() {
  const { data = [] } = useQuery<Income[]>({ queryKey: ["income"], queryFn: getIncome });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Ingresos</h2>
          <p className="text-sm text-slate-500">Reservas, alquileres e importes reales.</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-meadow hover:bg-green-700"><CalendarSync className="h-4 w-4" />Airbnb</Button>
          <Button className="bg-sun hover:bg-amber-700"><Upload className="h-4 w-4" />CSV</Button>
        </div>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-4">Huesped</th>
              <th className="p-4">Entrada</th>
              <th className="p-4">Salida</th>
              <th className="p-4">Noches</th>
              <th className="p-4">Origen</th>
              <th className="p-4 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((income) => (
              <tr key={income.id}>
                <td className="p-4 font-semibold">{income.guest_name ?? "Reserva"}</td>
                <td className="p-4">{formatDate(income.check_in)}</td>
                <td className="p-4">{formatDate(income.check_out)}</td>
                <td className="p-4">{income.nights ?? "-"}</td>
                <td className="p-4">{income.source}</td>
                <td className="p-4 text-right font-bold">{formatCurrency(income.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
