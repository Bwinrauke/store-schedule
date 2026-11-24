export type Role = "executive" | "manager";

export type Profile = { id: string; email: string; full_name: string; role: Role };
export type Store = { id: string; name: string; code: string | null; region: string | null; active: boolean };
export type Employee = {
  id: string;
  store_id: string;
  full_name: string;
  role: string;
  vrp_code?: string | null;
  active: boolean;
};
export type Shift = {
  id: string;
  store_id: string;
  employee_id: string;
  shift_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;
  break_minutes: number;
  role: string;
  note: string | null;
};
export type WeekSummaryRow = {
  store_id: string;
  store_name: string;
  store_code: string | null;
  region: string | null;
  total_hours: number;
  cashier_hours: number;
  sales_hours: number;
  keyholder_hours: number;
  shift_count: number;
  people_scheduled: number;
  days_covered: number;
  submitted_by: string | null;
  submitted_at: string | null;
};
