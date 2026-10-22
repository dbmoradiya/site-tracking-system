create table site_move_history (
    id bigserial primary key,
    site_id bigint not null references sites(id) on delete cascade,
    old_project_id bigint references projects(id) on delete set null,
    new_project_id bigint references projects(id) on delete set null,
    old_project_name varchar(255) not null,
    new_project_name varchar(255) not null,
    changed_by bigint not null references app_users(id),
    created_at timestamptz not null default now()
);
create index idx_site_move_history_site on site_move_history(site_id, created_at desc);
