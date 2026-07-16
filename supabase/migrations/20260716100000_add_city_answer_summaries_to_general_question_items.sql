alter table public.general_question_items
  add column if not exists city_answer_summaries jsonb not null default '[]'::jsonb;

alter table public.general_question_items
  add constraint general_question_items_city_answer_summaries_is_array
  check (jsonb_typeof(city_answer_summaries) = 'array');
