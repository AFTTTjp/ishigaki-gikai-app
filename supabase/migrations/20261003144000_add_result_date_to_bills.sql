alter table public.bills
add column if not exists result_date date;

comment on column public.bills.result_date is
  '議案の採決・結果確定日。一次資料で確認できた日付のみ保存し、不明な場合はNULL';
