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
