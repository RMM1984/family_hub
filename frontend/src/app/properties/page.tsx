"use client";

import { useQuery } from "@tanstack/react-query";
import { Bath, BedDouble, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getProperties } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Property } from "@/types";

export default function PropertiesPage() {
  const { data = [] } = useQuery<Property[]>({ queryKey: ["properties"], queryFn: getProperties });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Viviendas</h2>
        <p className="text-sm text-slate-500">Resumen operativo y rentabilidad por inmueble.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {data.map((property) => (
          <Card key={property.id} className="overflow-hidden">
            <img src={property.cover_image_url} alt={property.alias} className="h-48 w-full object-cover" />
            <div className="p-5">
              <p className="text-sm text-slate-500">{property.address}</p>
              <h3 className="mt-1 text-xl font-bold">{property.alias}</h3>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-2"><Users className="h-4 w-4" />{property.capacity_guests}</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-2"><BedDouble className="h-4 w-4" />{property.bedrooms}</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-2"><Bath className="h-4 w-4" />{property.bathrooms}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-slate-500">Inversion</p>
                  <p className="font-bold">{formatCurrency(Number(property.initial_investment) + Number(property.reform_cost))}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-slate-500">Rentabilidad</p>
                  <p className="font-bold text-meadow">4,8%</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
