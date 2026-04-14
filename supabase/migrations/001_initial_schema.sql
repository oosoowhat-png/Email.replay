-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Emails table
create table public.emails (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  gmail_message_id text unique not null,
  thread_id text not null,
  from_email text not null,
  from_name text not null default '',
  subject text not null default '',
  body text not null default '',
  received_at timestamptz not null,
  created_at timestamptz default now() not null
);

-- Replies table
create table public.replies (
  id uuid default gen_random_uuid() primary key,
  email_id uuid references public.emails(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  ai_draft text not null,
  sent_body text,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at timestamptz,
  created_at timestamptz default now() not null
);

-- Feedback table
create table public.feedback (
  id uuid default gen_random_uuid() primary key,
  reply_id uuid references public.replies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  star_rating integer not null check (star_rating >= 1 and star_rating <= 5),
  text_feedback text,
  created_at timestamptz default now() not null
);

-- Course embeddings table
create table public.course_embeddings (
  id uuid default gen_random_uuid() primary key,
  course_name text not null,
  course_link text not null,
  content text not null,
  embedding vector(384),
  metadata jsonb not null default '{}',
  created_at timestamptz default now() not null
);

-- Indexes
create index idx_emails_user_id on public.emails(user_id);
create index idx_emails_thread_id on public.emails(thread_id);
create index idx_replies_email_id on public.replies(email_id);
create index idx_replies_user_id on public.replies(user_id);
create index idx_feedback_reply_id on public.feedback(reply_id);
create index idx_course_embeddings_embedding on public.course_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 10);

-- Row Level Security
alter table public.emails enable row level security;
alter table public.replies enable row level security;
alter table public.feedback enable row level security;
alter table public.course_embeddings enable row level security;

-- RLS Policies: users can only access their own data
create policy "Users can view own emails"
  on public.emails for select
  using (auth.uid() = user_id);

create policy "Users can insert own emails"
  on public.emails for insert
  with check (auth.uid() = user_id);

create policy "Users can view own replies"
  on public.replies for select
  using (auth.uid() = user_id);

create policy "Users can insert own replies"
  on public.replies for insert
  with check (auth.uid() = user_id);

create policy "Users can update own replies"
  on public.replies for update
  using (auth.uid() = user_id);

create policy "Users can view own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- Course embeddings are readable by all authenticated users
create policy "Authenticated users can view course embeddings"
  on public.course_embeddings for select
  using (auth.role() = 'authenticated');

-- Match function for vector similarity search
create or replace function match_courses(
  query_embedding vector(384),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  course_name text,
  course_link text,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    ce.id,
    ce.course_name,
    ce.course_link,
    ce.content,
    ce.metadata,
    1 - (ce.embedding <=> query_embedding) as similarity
  from public.course_embeddings ce
  where 1 - (ce.embedding <=> query_embedding) > match_threshold
  order by ce.embedding <=> query_embedding
  limit match_count;
$$;
