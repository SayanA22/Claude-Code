-- Grants Supabase applies to the API roles. Table privileges say *what* a role
-- may do; Row Level Security says *which rows*. Both have to be right.
grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

grant select on all tables in schema public to anon;
