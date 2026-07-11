alter table public.general_question_items
  add column if not exists confirmed_facts text[] not null default '{}';
