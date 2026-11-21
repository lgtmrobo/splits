-- Multi-user: invited athletes only get activities from the moment they
-- connect, not a history import. NULL = full history (the owner);
-- a timestamp = nothing that started before it is synced.
alter table public.athletes
  add column if not exists history_from timestamptz;
