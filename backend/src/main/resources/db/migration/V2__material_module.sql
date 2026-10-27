-- Material module: stock, purchases, sales. Additive only; nothing existing is altered.
create table company_profile (
  id smallint primary key default 1 check (id = 1),
  name varchar(180) not null,
  address text not null default '',
  gst varchar(15) not null default '',
  mobile varchar(10) not null default '',
  updated_at timestamptz not null default now()
);
insert into company_profile(id,name) values (1,'Shreeji Enterprise');

create table material_types (
  id bigserial primary key,
  name varchar(180) not null,
  uom varchar(32) not null,
  created_at timestamptz not null default now()
);
create unique index material_types_name_uq on material_types (lower(name));

create table material_vendors (
  id bigserial primary key,
  name varchar(180) not null,
  mobile varchar(10) not null default '',
  gst varchar(15) not null default '',
  address text not null default '',
  created_at timestamptz not null default now()
);
create unique index material_vendors_name_uq on material_vendors (lower(name));

-- Document numbers are never reused for a date, even after a document is deleted.
create table material_doc_counters (
  kind varchar(8) not null,
  day date not null,
  last_no int not null,
  primary key (kind, day)
);

create table purchases (
  id bigserial primary key,
  purchase_code varchar(20) not null unique,
  purchase_date date not null,
  vendor_id bigint not null references material_vendors(id),
  bill_number varchar(80) not null default '',
  invoice_name varchar(255),
  invoice_type varchar(100),
  invoice_path varchar(500),
  active_from timestamptz not null default now(),
  created_by bigint,
  updated_by bigint,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by bigint
);
create table purchase_items (
  id bigserial primary key,
  purchase_id bigint not null references purchases(id) on delete cascade,
  position int not null,
  material_type_id bigint not null references material_types(id),
  uom varchar(32) not null,
  qty numeric(14,3) not null check (qty > 0),
  rate numeric(14,2) not null check (rate >= 0),
  gst numeric(5,2) not null check (gst >= 0)
);
create index purchase_items_purchase_idx on purchase_items(purchase_id);
create table purchase_versions (
  id bigserial primary key,
  purchase_id bigint not null references purchases(id) on delete cascade,
  version int not null,
  active_from timestamptz not null,
  active_to timestamptz not null,
  snapshot jsonb not null,
  unique (purchase_id, version)
);

create table sales (
  id bigserial primary key,
  sale_code varchar(20) not null unique,
  sale_type varchar(8) not null check (sale_type in ('DEBIT','CREDIT')),
  sale_date date not null,
  vendor_id bigint not null references material_vendors(id),
  active_from timestamptz not null default now(),
  created_by bigint,
  updated_by bigint,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by bigint
);
create table sale_items (
  id bigserial primary key,
  sale_id bigint not null references sales(id) on delete cascade,
  position int not null,
  material_type_id bigint not null references material_types(id),
  uom varchar(32) not null,
  qty numeric(14,3) not null check (qty > 0),
  rate numeric(14,2) not null check (rate >= 0),
  gst numeric(5,2) not null check (gst >= 0)
);
create index sale_items_sale_idx on sale_items(sale_id);
-- Sites are links only (one document, one stock effect). Links to sites survive nothing else: removing a site removes the link, not the sale.
create table sale_sites (
  sale_id bigint not null references sales(id) on delete cascade,
  site_id bigint not null references sites(id) on delete cascade,
  primary key (sale_id, site_id)
);
create index sale_sites_site_idx on sale_sites(site_id);
create table sale_versions (
  id bigserial primary key,
  sale_id bigint not null references sales(id) on delete cascade,
  version int not null,
  active_from timestamptz not null,
  active_to timestamptz not null,
  snapshot jsonb not null,
  unique (sale_id, version)
);
