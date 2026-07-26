-- EchoBottle: نفّذ هذا الملف مرة واحدة من Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(content) between 3 and 280),
  signature varchar(32) not null default '',
  mood varchar(16) not null check (mood in ('calm', 'curious', 'heavy', 'bright')),
  created_at timestamptz not null default now(),
  wave_count integer not null default 0 check (wave_count >= 0),
  spark_count integer not null default 0 check (spark_count >= 0),
  heart_count integer not null default 0 check (heart_count >= 0)
);

create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  content text not null check (char_length(content) between 3 and 180),
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_mood_idx on public.messages (mood);
create index if not exists replies_message_id_created_at_idx on public.replies (message_id, created_at desc);

-- لا تفتح الجداول مباشرة من المتصفح؛ الـ API يستخدم مفتاح الخادم فقط.
alter table public.messages enable row level security;
alter table public.replies enable row level security;
