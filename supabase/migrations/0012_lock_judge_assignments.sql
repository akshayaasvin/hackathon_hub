-- Jury assignment now goes through app/api/admin/judge-assignments (service-role,
-- verifies admin role server-side, verifies the assignee is actually a jury
-- user) instead of a direct client insert/delete. The RLS policy
-- judge_assignments_admin_all itself was verified working correctly with a
-- real admin session — the RLS error reported against it was caused by the
-- calling session not actually resolving is_admin()=true at the time (the
-- same orphaned-account / role-sync issue fixed earlier for other admins),
-- not a flaw in the policy. This migration is a hardening step matching the
-- lock-down pattern already used for teams/submissions, not a bug fix.
revoke insert, delete on public.judge_assignments from authenticated;
