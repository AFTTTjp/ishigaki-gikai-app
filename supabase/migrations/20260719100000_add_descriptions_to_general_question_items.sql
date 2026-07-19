alter table public.general_question_items
  add column if not exists normal_description text,
  add column if not exists detailed_description text;
