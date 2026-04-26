-- Supabase の SQL エディタで実行してください

-- tweets テーブル作成
create table if not exists public.tweets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_email text not null,
  content text not null check (char_length(content) <= 280),
  created_at timestamptz default now() not null
);

-- インデックス（新しい順に取得するため）
create index if not exists tweets_created_at_idx on public.tweets(created_at desc);

-- Row Level Security を有効化
alter table public.tweets enable row level security;

-- 全員が読み取り可能
create policy "誰でも閲覧できる" on public.tweets
  for select using (true);

-- 認証済みユーザーが自分のツイートを投稿できる
create policy "ログイン済みユーザーが投稿できる" on public.tweets
  for insert with check (auth.uid() = user_id);

-- 自分のツイートだけ削除できる
create policy "自分のツイートのみ削除できる" on public.tweets
  for delete using (auth.uid() = user_id);

-- Realtime を有効化
alter publication supabase_realtime add table public.tweets;
