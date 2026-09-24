-- ==========================================================
-- Esquema sugerido para produção (Supabase / PostgreSQL)
-- Substitui o armazenamento local do navegador por um banco
-- compartilhado entre todos os usuários e o dashboard de gestores.
-- ==========================================================

create table config_alcadas (
  nivel     smallint primary key check (nivel between 1 and 3),
  nome      text not null,
  limite    numeric(14,2) not null
);
insert into config_alcadas values
  (1, 'Comprador', 2000), (2, 'Supervisor', 10000), (3, 'Gerente', 50000);

create table usuarios (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text not null,
  email     text unique not null,
  nivel     smallint not null references config_alcadas(nivel),
  filial    text,
  ativo     boolean not null default true
);

create table solicitacoes (
  id                uuid primary key default gen_random_uuid(),
  numero            text unique not null,
  criado_em         timestamptz not null default now(),
  solicitante_id    uuid not null references usuarios(id),
  nivel_solicitante smallint not null,
  filial            text,
  centro_custo      text not null,
  categoria         text not null,
  fornecedor        text,
  urgencia          text not null default 'Normal',
  data_necessidade  date,
  justificativa     text,
  total             numeric(14,2) not null,
  nivel_necessario  smallint not null,        -- 4 = Diretoria
  status            text not null default 'pendente'
                    check (status in ('pendente','aprovado','reprovado','comprado','cancelado')),
  aprovador_id      uuid references usuarios(id),
  nivel_aprovador   smallint,
  decidido_em       timestamptz,
  comprado_em       timestamptz
);

create table solicitacao_itens (
  id              bigint generated always as identity primary key,
  solicitacao_id  uuid not null references solicitacoes(id) on delete cascade,
  descricao       text not null,
  qtd             numeric(14,3) not null,
  unidade         text not null,
  valor_unit      numeric(14,2) not null
);

create table solicitacao_historico (
  id              bigint generated always as identity primary key,
  solicitacao_id  uuid not null references solicitacoes(id) on delete cascade,
  em              timestamptz not null default now(),
  usuario         text not null,
  acao            text not null,
  obs             text
);

-- View pronta para o dashboard de gestores / Power BI
create view vw_dashboard_compras as
select s.numero, s.criado_em, date_trunc('month', s.criado_em) as mes,
       s.status, s.filial, s.centro_custo, s.categoria, s.fornecedor,
       s.total, s.nivel_necessario, s.nivel_aprovador,
       extract(epoch from (s.decidido_em - s.criado_em))/3600 as horas_ate_decisao,
       u.nome as solicitante
from solicitacoes s join usuarios u on u.id = s.solicitante_id;

-- Row Level Security (resumo):
--  * Nível 1 vê apenas as próprias solicitações;
--  * Níveis 2 e 3 veem todas;
--  * Aprovar/reprovar somente se nivel do usuário >= nivel_necessario.
-- Implemente a aprovação como função (RPC) no banco para que a regra
-- de alçada não dependa do navegador.
alter table solicitacoes enable row level security;
