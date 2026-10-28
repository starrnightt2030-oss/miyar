-- معيار — قاعدة البيانات الأونلاين
-- جدول واحد عام للسجلات (يعكس مخازن التطبيق) + الحسابات + اشتراكات الإشعارات + سجل استخدام الذكاء الاصطناعي

-- ===== الحسابات =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  role text not null default 'teacher' check (role in ('teacher', 'head', 'admin')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- أول مستخدم يسجّل = مدير النظام (معتمد تلقائياً). الباقون ينتظرون موافقة المدير.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, name, email, role, approved)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email,
          case when first_user then 'admin' else 'teacher' end, first_user);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_approved() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false);
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select approved and role in ('head', 'admin') from public.profiles where id = auth.uid()), false);
$$;
create or replace function public.my_role() returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select approved and role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_approved());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role() and approved = public.is_approved());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update using (public.is_admin());

-- ===== السجلات =====
create table if not exists public.records (
  id text primary key,
  store text not null check (store in ('subjects', 'units', 'lessons', 'outcomes', 'questions', 'exams', 'docs', 'log')),
  subject_id text,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid default auth.uid(),
  server_at timestamptz not null default now()
);
create index if not exists records_server_at on public.records (server_at);
create index if not exists records_store on public.records (store);

create or replace function public.touch_record() returns trigger language plpgsql as $$
begin
  new.server_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then new.created_by := old.created_by; end if;
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records for each row execute function public.touch_record();

alter table public.records enable row level security;
drop policy if exists records_read on public.records;
create policy records_read on public.records for select using (public.is_approved());
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert with check (
  public.is_approved() and (store <> 'docs' or public.is_admin())
);
drop policy if exists records_update on public.records;
create policy records_update on public.records for update using (
  public.is_approved() and (created_by = auth.uid() or public.is_staff()) and (store <> 'docs' or public.is_admin())
);

-- ===== اشتراكات الإشعارات =====
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sub jsonb not null,
  ua text,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists push_own on public.push_subs;
create policy push_own on public.push_subs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== استخدام الذكاء الاصطناعي (لمتابعة التكلفة) =====
create table if not exists public.ai_usage (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  model text,
  input_tokens int,
  output_tokens int,
  at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_read on public.ai_usage;
create policy ai_usage_read on public.ai_usage for select using (public.is_admin() or user_id = auth.uid());

-- ===== اللحظية =====
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'records') then
    alter publication supabase_realtime add table public.records;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
