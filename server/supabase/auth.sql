-- نفّذ هذا مرة واحدة من Supabase SQL Editor.
alter table public.messages
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists messages_user_id_idx on public.messages (user_id, created_at desc);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(32) not null default '',
  avatar_url text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  reply_id uuid not null references public.replies(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

create table if not exists public.future_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 3 and 500),
  unlock_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists future_letters_user_unlock_idx on public.future_letters (user_id, unlock_at);

create table if not exists public.site_visits (
  visit_date date not null default current_date,
  visitor_hash text not null check (char_length(visitor_hash) = 64),
  last_seen timestamptz not null default now(),
  primary key (visit_date, visitor_hash)
);

alter table public.profiles add column if not exists bio varchar(120) not null default '';
alter table public.profiles add column if not exists avatar varchar(16) not null default 'bottle';
alter table public.profiles add column if not exists accent_color varchar(16) not null default 'teal';

create index if not exists site_visits_last_seen_idx
  on public.site_visits (last_seen desc);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete set null,
  reporter_hash text not null check (char_length(reporter_hash) = 64),
  reason varchar(24) not null check (reason in ('harmful', 'spam', 'personal', 'other')),
  status varchar(16) not null default 'pending' check (status in ('pending', 'dismissed', 'resolved')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (message_id, reporter_hash)
);

create index if not exists message_reports_status_created_idx
  on public.message_reports (status, created_at desc);

-- Keep account data private even when the publishable key is used directly.
alter table public.favorites enable row level security;
alter table public.profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.future_letters enable row level security;
alter table public.site_visits enable row level security;
alter table public.message_reports enable row level security;

drop policy if exists "Users can read their favorites" on public.favorites;
create policy "Users can read their favorites" on public.favorites
  for select using (auth.uid() = user_id);
drop policy if exists "Users can add their favorites" on public.favorites;
create policy "Users can add their favorites" on public.favorites
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can remove their favorites" on public.favorites;
create policy "Users can remove their favorites" on public.favorites
  for delete using (auth.uid() = user_id);

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications" on public.notifications
  for select using (auth.uid() = user_id);
drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their notifications" on public.notifications;
create policy "Users can delete their notifications" on public.notifications
  for delete using (auth.uid() = user_id);

-- Locked letters stay unreadable through the public Data API. The trusted server
-- returns only their id and dates until unlock_at has passed.
drop policy if exists "Users can read unlocked future letters" on public.future_letters;
create policy "Users can read unlocked future letters" on public.future_letters
  for select using (auth.uid() = user_id and unlock_at <= now());
drop policy if exists "Users can create future letters" on public.future_letters;
create policy "Users can create future letters" on public.future_letters
  for insert with check (auth.uid() = user_id and unlock_at > now());
drop policy if exists "Users can delete their future letters" on public.future_letters;
create policy "Users can delete their future letters" on public.future_letters
  for delete using (auth.uid() = user_id);

alter table public.messages add column if not exists rarity varchar(16) not null default 'common';
alter table public.messages add column if not exists one_time boolean not null default false;
alter table public.messages add column if not exists claimed_at timestamptz;

create or replace function public.claim_one_time_message(p_mood text default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare chosen_id uuid;
begin
  select id into chosen_id from public.messages
    where one_time = true and claimed_at is null
      and (p_mood is null or mood = p_mood)
    order by random() limit 1 for update skip locked;
  if chosen_id is not null then
    update public.messages set claimed_at = now() where id = chosen_id;
  end if;
  return chosen_id;
end;
$$;

revoke all on function public.claim_one_time_message(text) from public;
revoke all on function public.claim_one_time_message(text) from anon;
revoke all on function public.claim_one_time_message(text) from authenticated;
grant execute on function public.claim_one_time_message(text) to service_role;
