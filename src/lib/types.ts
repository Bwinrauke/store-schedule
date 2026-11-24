export type Role = "executive" | "manager";

export type Profile = { id: string; email: string; full_name: string; role: Role };
export type Store = { id: string; name: string; code: string | null; region: string | null; active: boolean };
export type Employee = {
  id: string;
  store_id: string;
  full_name: string;
  position: string;
  phone: string | null;
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
  position: string | null;
  note: string | null;
};
export type WeekSummaryRow = {
  store_id: string;
  store_name: string;
  region: string | null;
  total_hours: number;
  shift_count: number;
  people_scheduled: number;
  active_employees: number;
  days_covered: number;
  last_updated: string | null;
};
