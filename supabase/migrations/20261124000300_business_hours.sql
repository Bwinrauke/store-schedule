-- Shifts fall within store hours, 8:00 AM to 9:00 PM, on 15-minute steps.
alter table public.shifts
  add constraint shifts_business_hours_check
  check (start_time >= time '08:00' and end_time <= time '21:00'),
  add constraint shifts_quarter_hour_check
  check (
    extract(second from start_time) = 0 and extract(second from end_time) = 0
    and extract(minute from start_time)::int % 15 = 0
    and extract(minute from end_time)::int % 15 = 0
  );
