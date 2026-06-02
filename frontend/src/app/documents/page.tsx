"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDocuments } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DocumentItem } from "@/types";

function tone(days?: number) {
  if (days === undefined) return "bg-slate-100 text-slate-700";
  if (days < 30) return "bg-rose-50 text-coral";
  if (days <= 60) return "bg-amber-50 text-sun";
  return "bg-emerald-50 text-meadow";
}

export default function DocumentsPage() {
  const { data = [] } = useQuery<DocumentItem[]>({ queryKey: ["documents"], queryFn: getDocuments });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Documentos</h2>
        <p className="text-sm text-slate-500">Vencimientos, historico y renovaciones.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.map((document) => (
          <Card key={document.id} className="p-5">
            <div className="flex gap-4">
              <div className={`grid h-11 w-11 place-items-center rounded-md ${tone(document.days_to_expire)}`}>
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{document.title}</h3>
                    <p className="text-sm text-slate-500">{document.provider ?? document.type}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone(document.days_to_expire)}`}>{document.days_to_expire ?? "-"} dias</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <span className="rounded-md bg-slate-100 p-3">Caduca<br /><b>{formatDate(document.expiration_date)}</b></span>
                  <span className="rounded-md bg-slate-100 p-3">Coste<br /><b>{formatCurrency(document.cost)}</b></span>
                </div>
                <Button className="mt-4 bg-ink"><RefreshCw className="h-4 w-4" />Renovar</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
