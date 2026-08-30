-- ===========================================================================
-- DayOS — initial schema
-- ---------------------------------------------------------------------------
-- Every table is owned by exactly one user and protected by Row Level
-- Security. There is no cross-user access path: policies compare `user_id`
-- against `auth.uid()`, which Postgres derives from the verified JWT, so a
-- client-supplied user id can never widen access.
--
-- Relationship note: `tasks.project_id` is a direct foreign key rather than a
-- `project_tasks` join table, because a task belongs to at most one project.
-- Goals are many-to-many with tasks (one study session can advance several
-- goals), so those use the `goal_tasks` join table.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------
do $$ begin
  create type task_priority as enum ('critical', 'high', 'medium', 'low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'completed', 'skipped', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type block_kind as enum ('task', 'break', 'fixed', 'buffer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type block_status as enum ('planned', 'in_progress', 'completed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('active', 'completed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_status as enum ('active', 'completed', 'archived');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- profiles
-- --------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text,
  timezone       text        not null default 'UTC',
  wake_time      time        not null default '07:00',
  bed_time       time        not null default '22:30',
  school_label   text,
  areas          text[]      not null default '{}',
  onboarded      boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- user_preferences
-- --------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  focus_session_minutes  int     not null default 45 check (focus_session_minutes between 10 and 180),
  break_minutes          int     not null default 10 check (break_minutes between 0 and 60),
  -- 'morning' | 'afternoon' | 'evening'
  energy_peak            text    not null default 'evening',
  -- Weekday windows the user is normally free, e.g.
  -- [{ "days": [1,2,3,4,5], "start": "16:00", "end": "21:00" }]
  free_windows           jsonb   not null default '[]'::jsonb,
  -- Learned multiplier applied to user duration estimates (see lib/planner/estimates.ts)
  estimate_multiplier    numeric not null default 1.0 check (estimate_multiplier between 0.5 and 3.0),
  notifications          jsonb   not null default
    '{"enabled": true, "sessionStart": true, "dailyPlanReminder": true, "deadlineWarnings": true, "quietHours": {"start": "22:00", "end": "07:00"}}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- goals
-- --------------------------------------------------------------------------
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  description text,
  deadline    date,
  status      goal_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals (user_id, status);

create table if not exists public.goal_milestones (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references public.goals (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  due_date   date,
  completed  boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists goal_milestones_goal_idx on public.goal_milestones (goal_id, position);

-- --------------------------------------------------------------------------
-- projects
-- --------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  goal_id     uuid references public.goals (id) on delete set null,
  title       text not null,
  description text,
  category    text not null default 'Personal',
  deadline    date,
  status      project_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, status);

-- --------------------------------------------------------------------------
-- tasks
-- --------------------------------------------------------------------------
create table if not exists public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  project_id         uuid references public.projects (id) on delete set null,
  title              text not null check (char_length(title) between 1 and 300),
  description        text,
  category           text not null default 'Personal',
  priority           task_priority not null default 'medium',
  deadline           timestamptz,
  estimated_duration int not null default 30 check (estimated_duration between 5 and 600),
  actual_duration    int,
  -- null | 'daily' | 'weekdays' | 'weekly'
  recurring          text,
  status             task_status not null default 'todo',
  notes              text,
  -- How many times the user has pushed this task. Feeds the priority score.
  postpone_count     int not null default 0,
  -- Task ids this task waits on. Kept as an array to avoid a join table for
  -- what is, in practice, a short list read alongside the task itself.
  depends_on         uuid[] not null default '{}',
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);
create index if not exists tasks_user_deadline_idx on public.tasks (user_id, deadline);
create index if not exists tasks_project_idx on public.tasks (project_id);

-- Goals <-> tasks (many-to-many)
create table if not exists public.goal_tasks (
  goal_id uuid not null references public.goals (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (goal_id, task_id)
);
create index if not exists goal_tasks_task_idx on public.goal_tasks (task_id);

-- --------------------------------------------------------------------------
-- fixed_events — commitments the planner must never schedule over
-- (classes, practice, work shifts). Either a one-off (start_at/end_at) or a
-- weekly recurrence (recurring_days + start_time/end_time).
-- --------------------------------------------------------------------------
create table if not exists public.fixed_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  category       text not null default 'School',
  start_at       timestamptz,
  end_at         timestamptz,
  recurring_days smallint[] not null default '{}',  -- 0=Sunday .. 6=Saturday
  start_time     time,
  end_time       time,
  created_at     timestamptz not null default now(),
  constraint fixed_events_shape check (
    (start_at is not null and end_at is not null and end_at > start_at)
    or (array_length(recurring_days, 1) is not null and start_time is not null and end_time is not null)
  )
);
create index if not exists fixed_events_user_idx on public.fixed_events (user_id);

-- --------------------------------------------------------------------------
-- schedule_blocks — the generated day plan
-- --------------------------------------------------------------------------
create table if not exists public.schedule_blocks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  task_id    uuid references public.tasks (id) on delete cascade,
  title      text not null,
  kind       block_kind not null default 'task',
  status     block_status not null default 'planned',
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  -- Local calendar day the block belongs to, so a day can be replaced atomically.
  local_date date not null,
  reason     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_blocks_span check (end_at > start_at)
);
create index if not exists schedule_blocks_user_day_idx on public.schedule_blocks (user_id, local_date, start_at);

-- --------------------------------------------------------------------------
-- reviews
-- --------------------------------------------------------------------------
create table if not exists public.daily_reviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  local_date       date not null,
  completed_count  int not null default 0,
  postponed_count  int not null default 0,
  planned_minutes  int not null default 0,
  actual_minutes   int not null default 0,
  reflection       text,
  ai_summary       text,
  created_at       timestamptz not null default now(),
  unique (user_id, local_date)
);

create table if not exists public.weekly_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  week_start  date not null,
  stats       jsonb not null default '{}'::jsonb,
  ai_summary  text,
  created_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_preferences','goals','projects','tasks','schedule_blocks'
  ] loop
    execute format(
      'drop trigger if exists touch_%1$s on public.%1$s;
       create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- New-user bootstrap: a profile + preferences row for every auth user.
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles         enable row level security;
alter table public.user_preferences enable row level security;
alter table public.goals            enable row level security;
alter table public.goal_milestones  enable row level security;
alter table public.projects         enable row level security;
alter table public.tasks            enable row level security;
alter table public.goal_tasks       enable row level security;
alter table public.fixed_events     enable row level security;
alter table public.schedule_blocks  enable row level security;
alter table public.daily_reviews    enable row level security;
alter table public.weekly_reviews   enable row level security;

-- profiles / user_preferences key off the primary key column.
drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists user_preferences_owner on public.user_preferences;
create policy user_preferences_owner on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Everything else keys off user_id.
do $$
declare t text;
begin
  foreach t in array array[
    'goals','goal_milestones','projects','tasks','goal_tasks',
    'fixed_events','schedule_blocks','daily_reviews','weekly_reviews'
  ] loop
    execute format('drop policy if exists %1$s_owner on public.%1$s;', t);
    execute format(
      'create policy %1$s_owner on public.%1$s
         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;
