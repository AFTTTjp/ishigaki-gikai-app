export type GeneralQuestionItem = {
  id: string;
  general_question_id: string;
  item_number: number;
  title: string;
  sub_items: string[];
};

export type GeneralQuestion = {
  id: string;
  slug: string;
  diet_session_id: string;
  member_id: string;
  question_number: number;
  question_date: string;
  seat_type: "floor" | "seat";
  source_kind: string;
  member_name_raw: string | null;
  status: string;
  items: GeneralQuestionItem[];
};

export type GeneralQuestionsByDate = {
  date: string;
  questions: GeneralQuestion[];
};

export type DietSessionInfo = {
  id: string;
  name: string;
  slug: string;
};
