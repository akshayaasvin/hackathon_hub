-- Soft delete for hackathons: preserves teams/submissions/results/judge_assignments
-- for audit trail (nothing else references hackathons with on delete cascade
-- anyway, so a hard delete would either cascade-wipe history or fail on FK —
-- neither is desirable here). deleted_at set means "hidden from every normal
-- query", not "gone".
alter table public.hackathons add column if not exists deleted_at timestamptz;

-- Public/participant/jury/college visibility must never include a deleted
-- hackathon, regardless of status.
drop policy if exists "hackathons_select_published" on public.hackathons;
create policy "hackathons_select_published" on public.hackathons
  for select using (status in ('published', 'ongoing', 'completed') and deleted_at is null);
