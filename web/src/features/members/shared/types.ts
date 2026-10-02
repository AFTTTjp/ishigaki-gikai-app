export interface MemberLink {
  id: string;
  member_id: string;
  service: string;
  label: string | null;
  url: string;
  sort_order: number;
}

export interface Member {
  id: string;
  name: string;
  name_kana: string | null;
  party: string | null;
  party_group: string | null;
  election_count: number | null;
  birth_date: string | null;
  address: string | null;
  image_url: string | null;
  website_url?: string | null;
  twitter_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  threads_url?: string | null;
  youtube_url?: string | null;
  line_url?: string | null;
  links?: MemberLink[];
}

/** 議員の在任期間（member_terms と議会任期から導出。終了日は在職終了日または議会任期の終了日） */
export interface MemberTenure {
  start_date: string;
  end_date: string;
}

/**
 * 議員詳細の取得結果。
 * - current: 現任の議員（現任期の名簿、またはlegacy表示時の名簿）
 * - former: 現任期の名簿に載っていない議員（前議員）。
 *   現在の政党・会派・当選回数として legacy 値を出さないよう、member の該当項目は null にする
 */
export interface MemberDetail {
  kind: "current" | "former";
  member: Member;
  /** former のときだけ設定する（過去の在任期間。取得できなければ空） */
  tenures: MemberTenure[];
}
