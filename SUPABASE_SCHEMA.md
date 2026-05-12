# Supabase Schema: 사내 규정집 Vector DB

## 1. 전제

- Supabase Postgres 사용
- pgvector 확장 사용
- embedding 모델은 OpenAI `text-embedding-3-small`
- embedding 차원은 `vector(1536)`
- Notion 사내 규정집 약 20개 규정을 청크 단위로 저장

## 2. 확장 활성화

```sql
create extension if not exists vector;
```

## 3. 권장안 A: 기존 notion_chunks 재사용

현재 프로젝트에는 `notion_chunks`와 `match_notion_chunks` 기반 코드가 이미 있으므로 MVP에서는 이 구조를 재사용하는 것이 가장 빠르다.

```sql
create table if not exists public.notion_chunks (
  id uuid primary key default gen_random_uuid(),
  page_id text not null,
  page_title text not null,
  page_url text,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notion_chunks_page_chunk_key
on public.notion_chunks (page_id, chunk_index);

create index if not exists notion_chunks_embedding_idx
on public.notion_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

```sql
create or replace function public.match_notion_chunks (
  query_embedding vector(1536),
  match_threshold float default 0.45,
  match_count int default 5
)
returns table (
  id uuid,
  page_id text,
  page_title text,
  page_url text,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    notion_chunks.id,
    notion_chunks.page_id,
    notion_chunks.page_title,
    notion_chunks.page_url,
    notion_chunks.chunk_index,
    notion_chunks.content,
    1 - (notion_chunks.embedding <=> query_embedding) as similarity
  from public.notion_chunks
  where
    notion_chunks.embedding is not null
    and 1 - (notion_chunks.embedding <=> query_embedding) > match_threshold
  order by notion_chunks.embedding <=> query_embedding
  limit match_count;
$$;
```

```sql
alter table public.notion_chunks enable row level security;
```

서버 API가 service role key로만 조회한다면 RLS select policy는 없어도 된다. 브라우저에서 직접 Supabase를 조회하지 않는다.

## 4. 권장안 B: company_rule_chunks로 명확히 분리

기존 교육 자료와 사내 규정 데이터를 분리하고 싶다면 다음 신규 테이블을 사용한다.

```sql
create table if not exists public.company_rule_chunks (
  id uuid primary key default gen_random_uuid(),
  rule_page_id text not null,
  rule_title text not null,
  rule_url text,
  chunk_index int not null,
  content text not null,
  category text,
  tags text[] default '{}',
  embedding vector(1536),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_rule_chunks_page_chunk_key
on public.company_rule_chunks (rule_page_id, chunk_index);

create index if not exists company_rule_chunks_embedding_idx
on public.company_rule_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index if not exists company_rule_chunks_title_idx
on public.company_rule_chunks (rule_title);
```

```sql
create or replace function public.match_company_rule_chunks (
  query_embedding vector(1536),
  match_threshold float default 0.45,
  match_count int default 5
)
returns table (
  id uuid,
  rule_page_id text,
  rule_title text,
  rule_url text,
  chunk_index int,
  content text,
  category text,
  similarity float
)
language sql
stable
as $$
  select
    company_rule_chunks.id,
    company_rule_chunks.rule_page_id,
    company_rule_chunks.rule_title,
    company_rule_chunks.rule_url,
    company_rule_chunks.chunk_index,
    company_rule_chunks.content,
    company_rule_chunks.category,
    1 - (company_rule_chunks.embedding <=> query_embedding) as similarity
  from public.company_rule_chunks
  where
    company_rule_chunks.embedding is not null
    and 1 - (company_rule_chunks.embedding <=> query_embedding) > match_threshold
  order by company_rule_chunks.embedding <=> query_embedding
  limit match_count;
$$;
```

```sql
alter table public.company_rule_chunks enable row level security;
```

## 5. 청크 content 권장 형식

```text
[사내 규정집]
규정명: {page_title}
조항/내용:
{chunk_text}
출처: {page_url}
```

## 6. 운영 체크포인트

- Notion integration이 사내 규정집 페이지에 초대되어 있어야 한다.
- service role key는 서버/API/스크립트에서만 사용한다.
- 내부 규정 데이터라면 배포 전 인증을 추가한다.
- embedding 모델 변경 시 vector 차원도 함께 변경해야 한다.
- 검색 품질은 테스트 질문으로 threshold를 조정한다.
