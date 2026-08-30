-- ===========================================================================
-- Test-only stand-in for the parts of Supabase the migration depends on.
--
-- A hosted Supabase project provides all of this. It is recreated here so the
-- schema and its Row Level Security policies can be run and verified against a
-- plain PostgreSQL instance — see `scripts/test-migration.sh`.
--
-- This file is NEVER applied to a real project.
-- ===========================================================================

create schema if not exists auth;

-- The subset of auth.users the migration's bootstrap trigger reads.
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Mirrors Supabase's own auth.uid(): the signed-in user's id, taken from the
-- verified JWT. PostgREST sets `request.jwt.claims` per request from the
-- validated token; nothing a client puts in a query body can influence it.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;

-- The two roles PostgREST connects as.
do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
