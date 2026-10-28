-- Material groups (e.g. 1 ACDB = 4 MCB + 1 Box). A group is only a template: a sale copies the child
-- quantities into normal sale_items rows, so stock, GST and history keep working on the child materials.
create table material_groups (
  id bigserial primary key,
  name varchar(180) not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index material_groups_name_uq on material_groups (lower(name));
create table material_group_items (
  id bigserial primary key,
  group_id bigint not null references material_groups(id) on delete cascade,
  position int not null,
  material_type_id bigint not null references material_types(id),
  qty numeric(14,3) not null check (qty > 0),
  unique (group_id, material_type_id)
);
-- Sale lines that came from a group. Existing sales keep these columns empty. The values are a snapshot taken at save time.
alter table sale_items add column group_line int;
alter table sale_items add column group_id bigint references material_groups(id);
alter table sale_items add column group_name varchar(180);
alter table sale_items add column group_qty numeric(14,3);
alter table sale_items add column group_per numeric(14,3);
create index sale_items_group_idx on sale_items(group_id);
