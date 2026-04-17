-- Setup for Supabase Vector RAG (local or cloud)
-- Run this script on your Supabase/Postgres database.

create extension if not exists vector;

create table if not exists public.ai_knowledge_documents (
  id bigint generated always as identity primary key,
  title text not null,
  language text not null default 'vi',
  category text not null default 'general',
  content text not null,
  source text not null default 'FAQ_NOI_BO',
  tags text[] not null default '{}',
  embedding vector(1536),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_documents_title_lang_unique unique (title, language)
);

create index if not exists idx_ai_knowledge_documents_active_lang
  on public.ai_knowledge_documents (is_active, language);

create index if not exists idx_ai_knowledge_documents_embedding
  on public.ai_knowledge_documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_ai_knowledge(
  query_embedding vector(1536),
  match_count int default 4,
  min_similarity float default 0.68,
  language_filter text default null
)
returns table (
  id bigint,
  title text,
  content text,
  language text,
  category text,
  source text,
  similarity float
)
language sql
stable
as $$
  select
    d.id,
    d.title,
    d.content,
    d.language,
    d.category,
    d.source,
    (1 - (d.embedding <=> query_embedding))::float as similarity
  from public.ai_knowledge_documents d
  where d.is_active = true
    and d.embedding is not null
    and (language_filter is null or d.language = language_filter or d.language = 'both')
    and (1 - (d.embedding <=> query_embedding)) >= min_similarity
  order by d.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant usage on schema public to anon, authenticated, service_role;
grant select on table public.ai_knowledge_documents to anon, authenticated, service_role;
grant execute on function public.match_ai_knowledge(vector, int, float, text)
  to anon, authenticated, service_role;
