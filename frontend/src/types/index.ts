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
  currency?: string | null;
  expense_date: string;
  source?: string | null;
  linked_document_id?: string | null;
  expense_month?: string | null;
  monthly_category?: string | null;
  data_origin?: string | null;
  source_method?: string | null;
  is_demo?: boolean;
  description?: string;
  property_alias?: string;
  property_address?: string;
}

export interface MonthlyExpenseItem {
  id?: string | null;
  category: "electricity" | "water" | "gas" | "internet" | "cleaning" | "supplies" | "maintenance" | "repairs" | "renovation" | "furniture" | "other";
  label: string;
  amount: number;
}

export interface MonthlyExpenseState {
  month: string;
  items: MonthlyExpenseItem[];
  total: number;
}

export interface MonthlyProfitRow {
  month: string;
  label?: string;
  income_total: number;
  expense_total: number;
  operating_expense_total?: number;
  ordinary_cost_total?: number;
  financing_interest_total?: number;
  financing_principal_total?: number;
  financing_total_payment?: number;
  net_profit: number;
  operating_profit?: number;
  profit_after_financing_cost?: number;
  cashflow_after_financing?: number;
  expense_ratio?: number | null;
  profit_margin?: number | null;
  pending_income_count?: number;
}

export interface MonthlyProfitStats {
  year: number;
  months: MonthlyProfitRow[];
}

export interface Income {
  id: string;
  property_id: string;
  source: string;
  amount: number | null;
  currency?: string | null;
  income_date: string;
  description?: string;
  guest_name?: string;
  check_in?: string;
  check_out?: string;
  nights?: number;
  reservation_id?: string | null;
  imported_from_airbnb?: boolean;
  amount_status?: "missing" | "manual" | "estimated" | "confirmed";
  data_origin?: string;
  is_demo?: boolean;
  source_method?: string | null;
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
  guest_count?: number | null;
  guest_count_status?: "missing" | "imported" | "manual" | null;
  amount_status?: "missing" | "manual" | "estimated" | "confirmed" | null;
  status: "confirmed" | "cancelled" | "blocked" | "removed_from_calendar";
  imported_from_ical: boolean;
  synced_at?: string;
  income_id?: string | null;
  income_amount?: number | null;
  income_amount_status?: "missing" | "manual" | "estimated" | "confirmed" | null;
  income_data_origin?: string | null;
  income_is_demo?: boolean | null;
  income_guest_name?: string | null;
  income_description?: string | null;
  source_method?: string;
  data_origin?: string;
  is_demo?: boolean;
  property_alias?: string;
}

export interface AirbnbEarningsImportRow {
  id: string;
  import_id: string;
  property_id: string;
  row_index: number;
  raw_data: Record<string, string>;
  reservation_id?: string | null;
  income_id?: string | null;
  match_status: "matched" | "possible_match" | "unmatched" | "applied";
  match_confidence?: number | string | null;
  suggested_check_in?: string | null;
  suggested_check_out?: string | null;
  suggested_guest_name?: string | null;
  suggested_amount?: number | string | null;
  suggested_currency?: string | null;
  suggested_host_fee?: number | string | null;
  suggested_cleaning_fee?: number | string | null;
  suggested_taxes?: number | string | null;
  suggested_payout?: number | string | null;
  applied: boolean;
  applied_at?: string | null;
  reservation_check_in?: string | null;
  reservation_check_out?: string | null;
  reservation_guest_name?: string | null;
  income_amount?: number | string | null;
  income_amount_status?: "missing" | "manual" | "estimated" | "confirmed" | null;
}

export interface AirbnbEarningsImport {
  id: string;
  property_id: string;
  filename?: string | null;
  status: string;
  rows_total: number;
  rows_matched: number;
  rows_applied: number;
  uploaded_at?: string;
  rows: AirbnbEarningsImportRow[];
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
  guests_known?: number;
  check_ins_current_month?: number;
  check_outs_current_month?: number;
}

export interface DocumentItem {
  id: string;
  property_id: string;
  type: string;
  subtype?: string;
  document_type?: "ibi" | "home_insurance" | "garbage_tax" | "energy_certificate" | "occupancy_certificate" | "tourist_license" | "other_essential" | string;
  document_category?: "essential" | "drive_inbox" | "operational_receipt" | "other";
  title: string;
  document_date?: string | null;
  valid_until?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: "pending_review" | "registered" | "reviewed" | "linked" | "ignored";
  source?: string | null;
  data_origin?: string | null;
  is_demo?: boolean;
  linked_expense_id?: string | null;
  linked_income_id?: string | null;
  provider?: string;
  expiration_date?: string;
  notes?: string | null;
  cost?: number;
  days_to_expire?: number;
  property_alias?: string;
  property_address?: string;
  deleted_at?: string | null;
}

export interface GroupedMonth<T> {
  month: string;
  label: string;
  income_total?: number;
  expense_total?: number;
  document_total?: number;
  ordinary_cost_total?: number;
  total_payment?: number;
  interest_total?: number;
  principal_total?: number;
  outstanding_principal?: number | null;
  pending_amount_count?: number;
  items: T[];
}

export interface FinancingPayment {
  id: string;
  property_id: string;
  payment_month: string;
  payment_date: string;
  lender?: string | null;
  total_payment: number;
  interest_amount: number;
  principal_amount: number;
  outstanding_principal?: number | null;
  notes?: string | null;
  linked_document_id?: string | null;
  linked_document_title?: string | null;
  is_demo?: boolean;
}

export interface GroupedFinancing {
  year: number;
  months: Array<GroupedMonth<FinancingPayment>>;
  year_total_payment: number;
  year_interest_total: number;
  year_principal_total: number;
  latest_outstanding_principal?: number | null;
}

export interface GroupedFinance<T> {
  year: number;
  months: GroupedMonth<T>[];
  year_total: number;
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
  review_status?: "pending_review" | "registered" | "reviewed" | "linked" | "registered_document" | "registered_expense" | "registered_income" | "ignored";
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
