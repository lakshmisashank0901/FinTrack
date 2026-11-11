-- Least-privilege login role for the FastAPI backend.
-- ---------------------------------------------------------------------------
-- fintrack_api owns no tables and has no privileges of its own (NOINHERIT).
-- For every request the API runs `SET LOCAL ROLE authenticated` and sets the
-- verified JWT claims, so Row Level Security applies exactly as it would for
-- the user. The role is created without LOGIN; enable it after migrating:
--
--   alter role fintrack_api with login password '<strong-generated-password>';
--
-- (Run that in the Supabase SQL editor; never commit the password.)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'fintrack_api') then
    create role fintrack_api nologin noinherit;
  end if;
end;
$$;

grant authenticated to fintrack_api;
grant usage on schema public to fintrack_api;
