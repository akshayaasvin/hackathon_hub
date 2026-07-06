-- One submission per team (a team edits/resubmits its single project rather
-- than accumulating rows). Required for the upsert(onConflict: 'team_id')
-- used by app/api/submissions/route.ts.
alter table public.submissions add constraint submissions_team_id_key unique (team_id);
