# Supabase Schema: FAQ Vector DB

## 1. 전제

- Supabase Postgres 사용
- pgvector 확장 사용
- MVP embedding 모델은 OpenAI `text-embedding-3-small` 기준
- `text-embedding-3-small` 기본 embedding 차원은 1536으로 가정
- 실제 구현 전 현재 OpenAI/Supabase 문서에서 모델 차원과 API 사용법을 다시 확인한다.

## 2. 확장 활성화

```sql
create extension if not exists vector;
```

## 3. FAQ 테이블

```sql
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  source text,
  source_url text,
  content text not null,
  embedding vector(1536),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 4. 검색 성능 인덱스

데이터가 적은 교육용 MVP에서는 인덱스 없이도 동작한다. FAQ가 수백 개 이상이면 인덱스를 추가한다.

```sql
create index if not exists faqs_embedding_idx
on public.faqs
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

## 5. 유사도 검색 함수

```sql
create or replace function public.match_faqs (
  query_embedding vector(1536),
  match_threshold float default 0.75,
  match_count int default 5
)
returns table (
  id uuid,
  question text,
  answer text,
  category text,
  source text,
  source_url text,
  similarity float
)
language sql
stable
as $$
  select
    faqs.id,
    faqs.question,
    faqs.answer,
    faqs.category,
    faqs.source,
    faqs.source_url,
    1 - (faqs.embedding <=> query_embedding) as similarity
  from public.faqs
  where
    faqs.is_public = true
    and faqs.embedding is not null
    and 1 - (faqs.embedding <=> query_embedding) > match_threshold
  order by faqs.embedding <=> query_embedding
  limit match_count;
$$;
```

## 6. RLS 정책 초안

공개 챗봇이 읽을 수 있는 FAQ만 노출한다.

```sql
alter table public.faqs enable row level security;

create policy "Public can read public FAQs"
on public.faqs
for select
to anon, authenticated
using (is_public = true);
```

데이터 적재는 서버 스크립트에서 service role key로 처리한다. service role key는 브라우저에 노출하지 않는다.

## 7. 샘플 데이터 형태

```json
{
  "question": "AI 초보자도 교육에 참여할 수 있나요?",
  "answer": "네. 기본적인 스마트폰과 웹 브라우저 사용이 가능하면 참여할 수 있습니다.",
  "category": "수강 대상",
  "source": "교육 FAQ",
  "source_url": "",
  "content": "질문: AI 초보자도 교육에 참여할 수 있나요?\n답변: 네. 기본적인 스마트폰과 웹 브라우저 사용이 가능하면 참여할 수 있습니다.\n카테고리: 수강 대상",
  "is_public": true
}
```

## 8. 운영 체크포인트

- Supabase 무료 플랜에서는 용량과 비활성화 정책을 확인한다.
- 교육용 FAQ 20~500개 수준은 일반적으로 작은 규모다.
- 공개 테이블은 RLS를 반드시 활성화한다.
- `service_role` 또는 secret key는 서버에서만 사용한다.
- embedding 모델 변경 시 `vector(1536)` 차원도 함께 변경해야 한다.

