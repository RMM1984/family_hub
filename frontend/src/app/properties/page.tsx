"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bath, BedDouble, CalendarClock, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getProperties } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Property } from "@/types";

export default function PropertiesPage() {
  const { data = [] } = useQuery<Property[]>({ queryKey: ["properties"], queryFn: getProperties });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Viviendas</h2>
        <p className="text-sm text-slate-500">Centro operativo para ingresos, gastos, documentos y estadisticas.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {data.map((property) => (
          <Link key={property.id} href={`/properties/${property.id}`} className="block">
            <Card className="h-full overflow-hidden transition hover:border-meadow">
              <img src={property.cover_image_url} alt={property.alias} className="h-48 w-full object-cover" />
              <div className="p-5">
                <p className="text-sm text-slate-500">{property.address}</p>
                <h3 className="mt-1 text-xl font-bold">{property.alias}</h3>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-2"><Users className="h-4 w-4" />{property.capacity_guests}</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-2"><BedDouble className="h-4 w-4" />{property.bedrooms}</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-2"><Bath className="h-4 w-4" />{property.bathrooms}</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md border border-slate-200 p-3">
                    <p className="text-slate-500">Ingresos</p>
                    <p className="font-bold">{formatCurrency(property.month_income)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <p className="text-slate-500">Gastos</p>
                    <p className="font-bold">{formatCurrency(property.month_expenses)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <p className="text-slate-500">Neto</p>
                    <p className="font-bold text-meadow">{formatCurrency(property.month_profit)}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-600">
                  <p className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4" />{property.next_document_title ?? "Sin vencimientos"} · {formatDate(property.next_document_expiration)}</p>
                  <p className="mt-1">Proxima reserva: {property.next_guest_name ?? "Sin reservas"} · {formatDate(property.next_check_in)}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
