import type { DashboardSummary, DocumentItem, Expense, Income, Property } from "@/types";

export const mockProperties: Property[] = [
  {
    id: "1",
    alias: "Apartamento Centro",
    address: "Calle Mayor 12, Madrid",
    city: "Madrid",
    type: "airbnb",
    initial_investment: 180000,
    reform_cost: 25000,
    cover_image_url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop",
    bedrooms: 2,
    bathrooms: 1,
    capacity_guests: 4,
    surface_m2: 75
  },
  {
    id: "2",
    alias: "Casa Pueblo",
    address: "Calle del Olivo 8, Javea",
    city: "Javea",
    type: "airbnb",
    initial_investment: 220000,
    reform_cost: 40000,
    cover_image_url: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?q=80&w=1200&auto=format&fit=crop",
    bedrooms: 3,
    bathrooms: 2,
    capacity_guests: 6,
    surface_m2: 120
  }
];

export const mockExpenses: Expense[] = [
  { id: "e1", property_id: "1", category: "electricity", provider: "Iberdrola", amount: 96.2, expense_date: "2026-05-15", description: "Factura mensual" },
  { id: "e2", property_id: "2", category: "cleaning", provider: "Limpiezas Ana", amount: 45, expense_date: "2026-05-19", description: "Limpieza reserva" },
  { id: "e3", property_id: "1", category: "internet", provider: "Simyo", amount: 35, expense_date: "2026-05-01", description: "Fibra" }
];

export const mockIncome: Income[] = [
  { id: "i1", property_id: "1", source: "airbnb", amount: 720, income_date: "2026-05-12", guest_name: "Laura Martin", check_in: "2026-05-08", check_out: "2026-05-12", nights: 4 },
  { id: "i2", property_id: "2", source: "airbnb", amount: 1320, income_date: "2026-05-22", guest_name: "Pablo Gomez", check_in: "2026-05-15", check_out: "2026-05-22", nights: 7 }
];

export const mockDocuments: DocumentItem[] = [
  { id: "d1", property_id: "1", type: "insurance", title: "Seguro hogar", provider: "Mapfre", expiration_date: "2026-07-17", cost: 280, days_to_expire: 45 },
  { id: "d2", property_id: "1", type: "certificate", title: "Certificado energetico", provider: "Tecnico certificado", expiration_date: "2026-07-02", cost: 90, days_to_expire: 30 },
  { id: "d3", property_id: "2", type: "license", title: "Licencia turistica", provider: "Ayuntamiento", expiration_date: "2031-06-02", cost: 0, days_to_expire: 1825 }
];

export const mockDashboard: DashboardSummary = {
  kpis: {
    net_profit_month: 1843.8,
    average_occupancy: 68,
    upcoming_expirations: 2,
    accumulated_roi: 4.2
  },
  properties: mockProperties,
  alerts: mockDocuments.slice(0, 2),
  series: [
    { label: "jun", ingresos: 1200, gastos: 360 },
    { label: "jul", ingresos: 2180, gastos: 440 },
    { label: "ago", ingresos: 2950, gastos: 510 },
    { label: "sep", ingresos: 1760, gastos: 390 },
    { label: "oct", ingresos: 1390, gastos: 420 },
    { label: "nov", ingresos: 980, gastos: 350 },
    { label: "dic", ingresos: 1540, gastos: 560 },
    { label: "ene", ingresos: 880, gastos: 330 },
    { label: "feb", ingresos: 1210, gastos: 340 },
    { label: "mar", ingresos: 1670, gastos: 380 },
    { label: "abr", ingresos: 2040, gastos: 415 },
    { label: "may", ingresos: 2565, gastos: 721 }
  ]
};
