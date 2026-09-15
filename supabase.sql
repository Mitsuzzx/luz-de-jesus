-- Luz de Jesus 💛 — rode no SQL Editor do Supabase (Dashboard > SQL > New query)
-- Cria as tabelas de doações + configurações. O backend usa a SERVICE_ROLE key,
-- então o RLS pode ficar restritivo (frontend nunca acessa o banco direto, só via /api).

create table if not exists donations (
  id text primary key,
  amount numeric not null check (amount >= 2),
  causa text not null default 'ambos',
  nome text not null default 'Anônimo',
  email text not null default '',
  status text not null default 'PENDING',
  code text,
  payment_link text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

-- valores iniciais (começa zerado; ajuste a meta pelo painel /admin)
insert into settings (key, value) values
  ('goal', '65000'),
  ('base_raised', '0'),
  ('base_donors', '0')
on conflict (key) do nothing;

-- índices p/ painel rápido
create index if not exists donations_status_idx on donations (status);
create index if not exists donations_created_idx on donations (created_at desc);

-- segurança: RLS ligado, sem policies públicas (só service_role, usada no backend)
alter table donations enable row level security;
alter table settings enable row level security;

-- === TRÁFEGO PAGO (estilo UTMify) + PIXEL ===
-- Rode este bloco também se você já rodou o SQL antes (é seguro repetir).
create table if not exists visits (
  id bigserial primary key,
  visitor_id text not null,
  path text not null default '/',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table donations add column if not exists visitor_id text;
alter table donations add column if not exists utm_source text;
alter table donations add column if not exists utm_medium text;
alter table donations add column if not exists utm_campaign text;
alter table donations add column if not exists utm_content text;
alter table donations add column if not exists utm_term text;
alter table donations add column if not exists fbp text;
alter table donations add column if not exists fbc text;
alter table donations add column if not exists event_id text;

create index if not exists visits_created_idx on visits (created_at desc);
create index if not exists visits_campaign_idx on visits (utm_campaign);
create index if not exists donations_campaign_idx on donations (utm_campaign);

alter table visits enable row level security;

-- === VERBA DE ANÚNCIOS (ROAS/ROI) ===
create table if not exists ad_spend (
  id text primary key,
  date date not null default current_date,
  campaign text not null default '(geral)',
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ad_spend_date_idx on ad_spend (date desc);
alter table ad_spend enable row level security;
