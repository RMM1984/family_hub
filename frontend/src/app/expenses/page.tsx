"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          <h2 className="text-2xl font-bold">Gastos</h2>
          <p className="text-sm text-slate-500">Facturas, recibos y gastos recurrentes.</p>
        </div>
        <Button className="hidden bg-meadow hover:bg-green-700 sm:inline-flex"><Plus className="h-4 w-4" />Nuevo gasto</Button>
      </div>
      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-200">
          {data.map((expense) => (
            <div key={expense.id} className="flex items-center gap-4 p-4">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-rose-50 text-coral"><Receipt className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{expense.provider ?? expense.category}</p>
                <p className="truncate text-sm text-slate-500">{expense.description} · {formatDate(expense.expense_date)}</p>
              </div>
              <p className="font-bold">{formatCurrency(expense.amount)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Button className="fixed bottom-5 right-5 h-14 rounded-full bg-meadow px-5 shadow-lg hover:bg-green-700 sm:hidden"><Plus className="h-5 w-5" />Nuevo gasto</Button>
    </div>
  );
}
