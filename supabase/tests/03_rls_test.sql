-- ===========================================================================
-- Row Level Security tests.
--
-- The claim DayOS makes is that a signed-in user can reach their own rows and
-- nothing else, and that a client cannot widen that by naming someone else's
-- id. These tests try to break both, as the `authenticated` role that
-- PostgREST actually connects as.
--
-- Any failure raises, so the script exits non-zero.
-- ===========================================================================

\set ON_ERROR_STOP on

begin;

-- --------------------------------------------------------------------------
-- Two users. Creating them should be enough — the bootstrap trigger does the
-- rest.
-- --------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@example.com',  '{"full_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@example.com',   '{"full_name": "Sam"}');

do $$
begin
  if (select count(*) from public.profiles) <> 2 then
    raise exception 'bootstrap trigger did not create a profile per user (got %)',
      (select count(*) from public.profiles);
  end if;
  if (select count(*) from public.user_preferences) <> 2 then
    raise exception 'bootstrap trigger did not create preferences per user';
  end if;
  if (select full_name from public.profiles
      where id = '11111111-1111-1111-1111-111111111111') <> 'Alex' then
    raise exception 'full_name was not carried over from user metadata';
  end if;
end $$;

-- Seed one task and one project for each user, as the owner (bypasses RLS).
insert into public.tasks (id, user_id, title, category, estimated_duration) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alex task', 'School', 45),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Sam task',  'School', 45);

insert into public.projects (id, user_id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000101', '11111111-1111-1111-1111-111111111111', 'Alex project'),
  ('bbbbbbbb-0000-0000-0000-000000000102', '22222222-2222-2222-2222-222222222222', 'Sam project');

insert into public.schedule_blocks (user_id, title, start_at, end_at, local_date) values
  ('11111111-1111-1111-1111-111111111111', 'Alex block', now(), now() + interval '30 min', current_date),
  ('22222222-2222-2222-2222-222222222222', 'Sam block',  now(), now() + interval '30 min', current_date);

commit;

-- ===========================================================================
-- Act as Alex.
-- ===========================================================================
set role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  false
);

do $$
declare n int;
begin
  -- ---- Reads are confined to the signed-in user -------------------------
  select count(*) into n from public.tasks;
  if n <> 1 then raise exception 'SELECT tasks: expected 1 own row, got %', n; end if;

  select count(*) into n from public.tasks
    where user_id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then
    raise exception 'SELECT tasks: naming another user''s id returned % rows', n;
  end if;

  select count(*) into n from public.projects;
  if n <> 1 then raise exception 'SELECT projects: expected 1, got %', n; end if;

  select count(*) into n from public.schedule_blocks;
  if n <> 1 then raise exception 'SELECT schedule_blocks: expected 1, got %', n; end if;

  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'SELECT profiles: expected 1, got %', n; end if;

  select count(*) into n from public.user_preferences;
  if n <> 1 then raise exception 'SELECT user_preferences: expected 1, got %', n; end if;
end $$;

do $$
declare n int;
begin
  -- ---- Writes cannot reach another user's rows --------------------------
  update public.tasks set title = 'hijacked'
    where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'UPDATE reached another user''s task'; end if;

  delete from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'DELETE reached another user''s task'; end if;

  update public.profiles set full_name = 'hijacked'
    where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'UPDATE reached another user''s profile'; end if;

  delete from public.schedule_blocks
    where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'DELETE reached another user''s schedule block'; end if;
end $$;

do $$
begin
  -- ---- A client cannot plant a row under someone else's id --------------
  -- This is the case the app's "never trust a client-supplied user id" rule
  -- exists for. Even if it were bypassed, the WITH CHECK clause refuses.
  begin
    insert into public.tasks (user_id, title, category, estimated_duration)
    values ('22222222-2222-2222-2222-222222222222', 'planted', 'School', 30);
    raise exception 'INSERT under another user''s id was allowed';
  exception
    when insufficient_privilege then null;  -- expected
  end;

  begin
    insert into public.projects (user_id, title)
    values ('22222222-2222-2222-2222-222222222222', 'planted');
    raise exception 'INSERT project under another user''s id was allowed';
  exception
    when insufficient_privilege then null;
  end;

  begin
    -- Reassigning your own row to someone else must fail the same way.
    update public.tasks
      set user_id = '22222222-2222-2222-2222-222222222222'
      where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'UPDATE reassigning a row to another user was allowed';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
declare n int;
begin
  -- ---- The user's own writes still work ---------------------------------
  insert into public.tasks (user_id, title, category, estimated_duration)
  values ('11111111-1111-1111-1111-111111111111', 'own new task', 'Music', 30);

  select count(*) into n from public.tasks;
  if n <> 2 then raise exception 'own INSERT did not land (see % rows)', n; end if;

  update public.tasks set title = 'renamed'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'own UPDATE did not apply'; end if;
end $$;

-- ===========================================================================
-- Act as Sam — the isolation has to hold in both directions.
-- ===========================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  false
);

do $$
declare n int; t text;
begin
  select count(*) into n from public.tasks;
  if n <> 1 then raise exception 'Sam sees % tasks, expected 1', n; end if;

  select title into t from public.tasks limit 1;
  if t <> 'Sam task' then raise exception 'Sam sees the wrong task: %', t; end if;

  -- Alex renamed a row a moment ago; Sam must not see the rename or the row.
  select count(*) into n from public.tasks where title in ('renamed', 'own new task');
  if n <> 0 then raise exception 'Sam can see Alex''s rows'; end if;
end $$;

-- ===========================================================================
-- Act as an anonymous visitor — no JWT at all.
-- ===========================================================================
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);

do $$
declare n int;
begin
  select count(*) into n from public.tasks;
  if n <> 0 then raise exception 'anonymous read returned % task rows', n; end if;

  select count(*) into n from public.profiles;
  if n <> 0 then raise exception 'anonymous read returned % profile rows', n; end if;

  select count(*) into n from public.schedule_blocks;
  if n <> 0 then raise exception 'anonymous read returned % schedule rows', n; end if;
end $$;

reset role;

-- ===========================================================================
-- Schema-level guarantees the app relies on.
-- ===========================================================================
do $$
declare
  unprotected text;
begin
  -- Every table in public must have RLS enabled. A new table added without it
  -- would be readable by every user.
  select string_agg(c.relname, ', ')
    into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if unprotected is not null then
    raise exception 'tables without row level security: %', unprotected;
  end if;
end $$;

do $$
declare
  unpoliced text;
begin
  -- RLS enabled with no policy denies everything, which would be a silent
  -- outage rather than a leak — still worth catching.
  select string_agg(c.relname, ', ')
    into unpoliced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  if unpoliced is not null then
    raise exception 'tables with RLS but no policy: %', unpoliced;
  end if;
end $$;

do $$
begin
  -- Deleting a user must take their data with them.
  delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

  if exists (select 1 from public.tasks
             where user_id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'tasks survived the deletion of their user';
  end if;
  if exists (select 1 from public.profiles
             where id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'profile survived the deletion of its user';
  end if;
end $$;

select 'all row level security tests passed' as result;
