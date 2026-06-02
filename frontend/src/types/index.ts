export interface Property {
  id: string;
  alias: string;
  address: string;
  city: string;
  type: string;
  initial_investment: number;
  reform_cost: number;
  cover_image_url?: string;
  capacity_guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  surface_m2?: number;
  notes?: string;
  month_income?: number;
  month_expenses?: number;
  month_profit?: number;
  next_document_title?: string | null;
  next_document_expiration?: string | null;
  next_check_in?: string | null;
  next_guest_name?: string | null;
}

export interface Expense {
  id: string;
  property_id: string;
  category: string;
  provider?: string;
  amount: number;
  expense_date: string;
  description?: string;
  property_alias?: string;
  property_address?: string;
}

export interface Income {
  id: string;
  property_id: string;
  source: string;
  amount: number | null;
  income_date: string;
  guest_name?: string;
  check_in?: string;
  check_out?: string;
  nights?: number;
  property_alias?: string;
  property_address?: string;
}

export interface DocumentItem {
  id: string;
  property_id: string;
  type: string;
  subtype?: string;
  title: string;
  provider?: string;
  expiration_date?: string;
  cost?: number;
  days_to_expire?: number;
  property_alias?: string;
  property_address?: string;
}

export interface Movement {
  id: string;
  kind: "Ingreso" | "Gasto";
  property_id: string;
  property_alias: string;
  movement_date: string;
  amount: number | null;
  description?: string;
  guest_name?: string;
  provider?: string;
}

export interface DashboardSummary {
  kpis: {
    net_profit_month: number;
    average_occupancy: number;
    upcoming_expirations: number;
    accumulated_roi: number;
  };
  properties: Property[];
  alerts: DocumentItem[];
  latest_movements?: Movement[];
  series: Array<{ label: string; ingresos: number; gastos: number }>;
}
