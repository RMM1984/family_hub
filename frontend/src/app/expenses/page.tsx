"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getExpenses } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Expense } from "@/types";

export default function ExpensesPage() {
  const { data = [] } = useQuery<Expense[]>({ queryKey: ["expenses"], queryFn: getExpenses });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Gastos globales</h2>
          <p className="text-sm text-slate-500">Agregado de gastos. Crea nuevos gastos desde la vivienda correspondiente.</p>
        </div>
        <Link href="/properties" className="hidden h-10 items-center justify-center rounded-md bg-meadow px-4 text-sm font-semibold text-white sm:inline-flex">Elegir vivienda</Link>
      </div>
      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-200">
          {data.map((expense) => (
            <div key={expense.id} className="flex items-center gap-4 p-4">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-rose-50 text-coral"><Receipt className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{expense.provider ?? expense.category}</p>
                <p className="truncate text-sm text-slate-500">{expense.description} · {formatDate(expense.expense_date)}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-ink"><Building2 className="h-4 w-4" />{expense.property_alias ?? "Vivienda"}</p>
              </div>
              <p className="font-bold">{formatCurrency(expense.amount)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
