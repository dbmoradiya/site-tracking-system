-- Older builds shipped demo logins that all shared one well-known password hash.
-- Deactivate any non-Admin account that still has that hash. No data is deleted; an Admin can
-- re-enable a person by setting a new password in Setup > Employees.
-- (The legacy Admin account is handled at startup, which refuses to run it with a known password.)
update app_users set active = false
where role <> 'ADMIN'
  and password_hash = '$2y$10$uM9ZuAcxZbscrfjjpjdSTOkMQ1IWghnyocqL7VAFvoED4V6ceoAPK';
