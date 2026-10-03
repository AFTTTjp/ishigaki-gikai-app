/**
 * ページレイアウトに関するユーティリティ
 *
 * TOPページと議案詳細ページは「メインページ」として扱い、DifficultySelectorを表示する。
 * チャットサイドバー用のオフセットレイアウトは isChatSidebarPage で判定する。
 */

/**
 * DifficultySelectorを表示するページかどうかを判定
 * 主要コンテンツが normal / hard で切り替わるページだけに限定する
 */
export function isDifficultyTogglePage(pathname: string): boolean {
  if (isMainPage(pathname)) return true;
  // 会議議案一覧ページ（/kokkai/[slug]/bills）
  if (/\/kokkai\/[^/]+\/bills$/.test(pathname)) return true;
  // 一般質問ページ（/general-questions/[sessionSlug]）
  if (/\/general-questions\/[^/]+$/.test(pathname)) return true;
  return false;
}

/**
 * チャットを右サイドバーとして表示するページかどうかを判定
 * pc 以上では ChatWindow が常時表示されるため、MainLayout が本文側に
 * サイドバー分のオフセットを付ける。DifficultySelector の表示判定とは
 * 独立させる（難易度切替が無くてもチャットを置くページがあるため）。
 */
export function isChatSidebarPage(pathname: string): boolean {
  if (isDifficultyTogglePage(pathname)) return true;
  // 議員名簿ページ（難易度切替は無いが PageChatClient を表示する）
  if (pathname === "/members") return true;
  return false;
}

/** メインページ（TOP、議案詳細）かどうかを判定 */
export function isMainPage(pathname: string): boolean {
  // トップページ
  if (pathname === "/") return true;
  // 議案詳細ページ（/bills/[id]）- サブパスは除外
  if (/\/bills\/[^/]+$/.test(pathname)) return true;
  // Topics詳細ページ（/topics/[slug]）
  if (/\/topics\/[^/]+$/.test(pathname)) return true;
  return false;
}

/** インタビューチャットページかどうかを判定 */
export function isInterviewPage(pathname: string): boolean {
  // /bills/[id]/interview/chat
  return /\/bills\/[^/]+\/interview\/chat$/.test(pathname);
}

/** インタビューセクション（LP・チャット含む）かどうかを判定 */
export function isInterviewSection(pathname: string): boolean {
  // /bills/[id]/interview 以下すべて
  return /\/bills\/[^/]+\/interview(\/|$)/.test(pathname);
}

/** インタビューページからbillIdを抽出 */
export function extractBillIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/bills\/([^/]+)/);
  return match ? match[1] : null;
}
