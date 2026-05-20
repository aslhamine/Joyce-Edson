create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text,
  table_number integer,
  table_name text,
  guest_count integer not null default 1,
  invite_token text,
  answer text not null check (answer in ('sim', 'nao')),
  message text,
  is_approved boolean not null default false
);

alter table public.rsvps add column if not exists guest_count integer not null default 1;
alter table public.rsvps add column if not exists invite_token text;

create index if not exists rsvps_created_at_idx on public.rsvps (created_at desc);
create index if not exists rsvps_invite_token_idx on public.rsvps (invite_token);

create table if not exists public.event_tables (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  number integer not null,
  name text not null,
  capacity integer not null check (capacity > 0)
);

create table if not exists public.invited_guests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text,
  email text,
  group_size integer not null default 1 check (group_size > 0),
  max_companions integer not null default 1 check (max_companions > 0),
  table_id uuid references public.event_tables(id) on delete set null,
  invite_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'attending', 'declined'))
);

create table if not exists public.invite_settings (
  id text primary key default 'default',
  message text not null,
  image text not null,
  show_table boolean not null default true
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invite-assets',
  'invite-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create index if not exists invited_guests_table_id_idx on public.invited_guests (table_id);
create index if not exists invited_guests_invite_token_idx on public.invited_guests (invite_token);

alter table public.rsvps enable row level security;
alter table public.event_tables enable row level security;
alter table public.invited_guests enable row level security;
alter table public.invite_settings enable row level security;

drop policy if exists "Public can create RSVP" on public.rsvps;
create policy "Public can create RSVP"
on public.rsvps for insert
to anon
with check (true);

drop policy if exists "Public can read approved wall messages" on public.rsvps;
create policy "Public can read approved wall messages"
on public.rsvps for select
to anon
using (is_approved = true and answer = 'sim');

drop policy if exists "Authenticated admins manage RSVPs" on public.rsvps;
create policy "Authenticated admins manage RSVPs"
on public.rsvps for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins manage event tables" on public.event_tables;
create policy "Authenticated admins manage event tables"
on public.event_tables for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins manage invited guests" on public.invited_guests;
create policy "Authenticated admins manage invited guests"
on public.invited_guests for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins manage invite settings" on public.invite_settings;
create policy "Authenticated admins manage invite settings"
on public.invite_settings for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read invite settings" on public.invite_settings;
create policy "Public can read invite settings"
on public.invite_settings for select
to anon
using (id = 'default');

drop policy if exists "Public can read invite assets" on storage.objects;
create policy "Public can read invite assets"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'invite-assets');

drop policy if exists "Authenticated admins upload invite assets" on storage.objects;
create policy "Authenticated admins upload invite assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'invite-assets');

drop policy if exists "Authenticated admins update invite assets" on storage.objects;
create policy "Authenticated admins update invite assets"
on storage.objects for update
to authenticated
using (bucket_id = 'invite-assets')
with check (bucket_id = 'invite-assets');

drop policy if exists "Authenticated admins delete invite assets" on storage.objects;
create policy "Authenticated admins delete invite assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'invite-assets');

create or replace function public.get_invite_by_token(token_value text)
returns table (
  name text,
  group_size integer,
  max_companions integer,
  table_number integer,
  table_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    invited_guests.name,
    invited_guests.group_size,
    invited_guests.max_companions,
    event_tables.number as table_number,
    event_tables.name as table_name
  from public.invited_guests
  left join public.event_tables on event_tables.id = invited_guests.table_id
  where invited_guests.invite_token = token_value
  limit 1
$$;

revoke all on function public.get_invite_by_token(text) from public;
grant execute on function public.get_invite_by_token(text) to anon, authenticated;
