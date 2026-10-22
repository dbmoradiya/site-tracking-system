-- Production only (profile "prod"): removes the demo seed data created by earlier migrations
-- so a fresh production database starts empty. The first Admin is created at startup from
-- APP_BOOTSTRAP_ADMIN_* environment variables (see ProductionBootstrap).
delete from projects;      -- cascades Sites, Stages, evidence rows, assignments and history
delete from site_types;    -- cascades default Stage templates
delete from teams;
delete from app_users;
delete from employees;     -- cascades employee roles
