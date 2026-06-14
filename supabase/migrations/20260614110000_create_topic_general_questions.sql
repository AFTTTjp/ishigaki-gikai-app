-- topic_general_questions: topics と general_questions の多対多中間テーブル
-- topic_bills と同じパターンに揃える

create table if not exists public.topic_general_questions (
  id                    uuid primary key default gen_random_uuid(),
  topic_id              uuid not null references public.topics(id) on delete cascade,
  general_question_id   uuid not null references public.general_questions(id) on delete cascade,
  created_at            timestamptz not null default now(),
  unique (topic_id, general_question_id)
);

create index idx_topic_general_questions_topic_id
  on public.topic_general_questions(topic_id);

create index idx_topic_general_questions_general_question_id
  on public.topic_general_questions(general_question_id);

alter table public.topic_general_questions enable row level security;

-- anon / authenticated は topic.status='active' かつ general_question.status='published' の場合のみ読み取り可
-- 注意: bills は publish_status だが general_questions は status
create policy "topic_general_questions_public_read"
  on public.topic_general_questions
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.topics t
      where t.id = topic_general_questions.topic_id
        and t.status = 'active'
    )
    and exists (
      select 1
      from public.general_questions gq
      where gq.id = topic_general_questions.general_question_id
        and gq.status = 'published'
    )
  );

-- service role（createAdminClient）はRLSをバイパスするためポリシー不要
grant select on public.topic_general_questions to anon, authenticated;
