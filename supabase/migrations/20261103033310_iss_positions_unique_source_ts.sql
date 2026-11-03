-- If the API returns the same reading twice (same source timestamp), the worker's
-- upsert skips it instead of inserting a duplicate row: only new positions are saved.
alter table public.iss_positions
  add constraint iss_positions_source_ts_key unique (source_ts);
