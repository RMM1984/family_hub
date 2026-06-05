export interface Property {
  id: string;
  alias: string;
  address: string;
  city: string;
  type: string;
  operation_type?: "tourist" | "long_term" | "own_use" | "mixed" | "inactive";
  rental_type?: "tourist" | "long_term" | "own_use" | "mixed" | "inactive";
  airbnb_enabled?: boolean;
  airbnb_ical_url?: string | null;
  airbnb_last_sync_at?: string | null;
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
  reservation_id?: string | null;
  imported_from_airbnb?: boolean;
  amount_status?: "missing" | "manual" | "estimated" | "confirmed";
  property_alias?: string;
  property_address?: string;
}

export interface Reservation {
  id: string;
  property_id: string;
  source: "airbnb";
  external_id?: string;
  title?: string;
  guest_name?: string | null;
  check_in: string;
  check_out: string;
  nights?: number;
  status: "confirmed" | "cancelled" | "blocked" | "removed_from_calendar";
  imported_from_ical: boolean;
  synced_at?: string;
  income_id?: string | null;
  income_amount?: number | null;
  income_amount_status?: "missing" | "manual" | "estimated" | "confirmed" | null;
  property_alias?: string;
}

export interface AirbnbStats {
  reservations_total: number;
  upcoming_reservations: number;
  next_check_in?: string | null;
  next_check_out?: string | null;
  booked_nights_current_month: number;
  booked_nights_next_30_days: number;
  occupancy_current_month: number;
  occupancy_next_30_days: number;
  incomes_missing_amount: number;
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

export interface DriveIntegration {
  id: string;
  property_id: string;
  provider: "google_drive";
  folder_id: string;
  folder_name?: string;
  folder_url?: string;
  connected_at?: string;
  last_sync_at?: string;
  is_active: boolean;
}

export interface DriveFolderMapping {
  id: string;
  property_id: string;
  connection_id?: string | null;
  drive_folder_id: string;
  drive_folder_name: string;
  drive_folder_url?: string;
  folder_type: string;
  provider_hint?: string | null;
  sync_enabled: boolean;
  connected_at?: string;
  last_sync_at?: string;
  file_count?: number;
  property_alias?: string;
  property_address?: string;
  metadata?: {
    drive_folder_name?: string;
  };
}

export interface AvailableDriveFolder {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface DriveFile {
  id: string;
  property_id: string;
  drive_folder_id: string;
  drive_folder_mapping_id?: string | null;
  drive_file_id: string;
  name: string;
  mime_type?: string;
  size?: number;
  web_view_link?: string;
  web_content_link?: string;
  created_time?: string;
  modified_time?: string;
  document_type?: string;
  folder_type?: string;
  provider_hint?: string;
  review_status?: "pending_review" | "registered" | "reviewed" | "linked" | "ignored";
  source_provider?: string;
  source_method?: string;
  source_folder_name?: string;
  source_synced_at?: string;
  linked_expense_id?: string;
  linked_document_id?: string;
  linked_expense_description?: string;
  linked_document_title?: string;
  property_alias?: string;
  expiration_date?: string;
}

export interface DriveState {
  integration: DriveIntegration | null;
  folders: DriveFolderMapping[];
  files: DriveFile[];
  google_configured: boolean;
  google_connected?: boolean;
  scope: string;
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
  upcoming_reservations?: Reservation[];
  incomes_missing_amount?: Reservation[];
  latest_movements?: Movement[];
  series: Array<{ label: string; ingresos: number; gastos: number }>;
}
