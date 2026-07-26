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
