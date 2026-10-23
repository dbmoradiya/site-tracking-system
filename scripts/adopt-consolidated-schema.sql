-- One-time helper for a database that was created by the OLD incremental migrations (V1 to V13).
-- The consolidated V1__initial_schema.sql produces exactly the same schema, so this only rewrites
-- Flyway's bookkeeping table. No business data is read, changed or deleted.
-- Back up first:  pg_dump -U sitetrack sitetrack > backup.sql
-- Run once, then start the new version of the app:
--   psql -U sitetrack -d sitetrack -v ON_ERROR_STOP=1 -f scripts/adopt-consolidated-schema.sql
-- A new, empty database does not need this. If the history is not exactly the old one, nothing changes.
begin;
do $$
declare h text;
begin
  select string_agg(version, ',' order by installed_rank) into h from flyway_schema_history where success;
  if h is distinct from '1,2,3,4,5,6,7,8,9,10,11,12,13' and h is distinct from '1,2,3,4,5,6,7,8,9,10,11,12,13,1000' then
    raise exception 'Unexpected migration history (%). Nothing was changed.', h;
  end if;
end $$;
delete from flyway_schema_history where version <> '1';
update flyway_schema_history set description = 'initial schema', script = 'V1__initial_schema.sql', checksum = 488284029 where version = '1';
commit;
