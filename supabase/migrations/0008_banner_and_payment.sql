-- Adds admin-configurable Razorpay payment button + banner image storage for hackathons.

alter table public.hackathons add column if not exists razorpay_button_id text;

-- Public storage bucket for hackathon banner images. Banners are shown on the
-- public hackathon listing, so read access is public; only admins can write.
insert into storage.buckets (id, name, public)
values ('hackathon-banners', 'hackathon-banners', true)
on conflict (id) do nothing;

create policy "hackathon_banners_public_read"
on storage.objects for select
using (bucket_id = 'hackathon-banners');

create policy "hackathon_banners_admin_insert"
on storage.objects for insert
with check (bucket_id = 'hackathon-banners' and is_admin());

create policy "hackathon_banners_admin_update"
on storage.objects for update
using (bucket_id = 'hackathon-banners' and is_admin())
with check (bucket_id = 'hackathon-banners' and is_admin());

create policy "hackathon_banners_admin_delete"
on storage.objects for delete
using (bucket_id = 'hackathon-banners' and is_admin());
