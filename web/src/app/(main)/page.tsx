import { Container } from "@/components/layouts/container";
import { About } from "@/components/top/about";
import { AFTTT } from "@/components/top/afttt";
import { Hero } from "@/components/top/hero";
import { TeamMirai } from "@/components/top/team-mirai";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { BillDisclaimer } from "@/features/bills/client/components/bill-detail/bill-disclaimer";
import { PreviousSessionSection } from "@/features/bills/server/components/previous-session-section";
import { getBillsByDietSession } from "@/features/bills/server/loaders/get-bills-by-diet-session";
import { getPreviousSessionBills } from "@/features/bills/server/loaders/get-previous-session-bills";
import type { BillWithContent } from "@/features/bills/shared/types";
import { getBillDisplayTitle } from "@/features/bills/shared/utils/bill-title";
import { HomeChatClient } from "@/features/chat/client/components/home-chat-client";
import { CurrentDietSession } from "@/features/diet-sessions/client/components/current-diet-session";
import { HomeDietSessionBillsSection } from "@/features/diet-sessions/client/components/home-diet-session-bills-section";
import { getActiveDietSession } from "@/features/diet-sessions/server/loaders/get-active-diet-session";
import { getCurrentDietSession } from "@/features/diet-sessions/server/loaders/get-current-diet-session";
import { getAllPreviousDietSessions } from "@/features/diet-sessions/server/loaders/get-previous-diet-session";
import { sortBillsByNumber } from "@/features/diet-sessions/shared/utils/sort-bills-by-number";
import { TopicsSection } from "@/features/topics/server/components/topics-section";
import { getTopics } from "@/features/topics/server/loaders/get-topics";
import { getJapanTime } from "@/lib/utils/date";

export default async function Home() {
  const [
    difficultyLevel,
    activeSession,
    previousSessions,
    currentSession,
    topics,
  ] = await Promise.all([
    getDifficultyLevel(),
    getActiveDietSession(),
    getAllPreviousDietSessions(),
    getCurrentDietSession(getJapanTime()),
    getTopics(),
  ]);
  const previousSessionData = await getPreviousSessionBills({
    difficultyLevel,
    previousSessions,
  });

  // 会期終了後もトップに直近会期の議案導線を残すため、開催中の会期（currentSession）が
  // 無ければ is_active 会期（activeSession）へフォールバックする表示用セッション。
  // ※ CurrentDietSession バナーは日付基準を保つため currentSession のまま（下記参照）。
  const displaySession = currentSession ?? activeSession;

  const sessionBills = sortBillsByNumber(
    displaySession ? await getBillsByDietSession(displaySession.id) : []
  );
  const today = getJapanTime();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isSessionClosed =
    displaySession != null && todayYmd > displaySession.end_date;

  const toBillChatContext = (bill: BillWithContent) => {
    return {
      name: getBillDisplayTitle(bill),
      summary: bill.bill_content?.summary,
      tags: bill.tags?.map((tag) => tag.label) || [],
      isFeatured: bill.is_featured,
    };
  };

  return (
    <>
      <Hero />

      {/* 本日の議会セクション（バナーは日付基準。閉会後は「開催なし」を維持） */}
      <CurrentDietSession session={currentSession} />

      {/* 今会期の公開議案を重複なく全件表示 */}
      <HomeDietSessionBillsSection
        session={displaySession}
        bills={sessionBills}
        closed={isSessionClosed}
      />

      {topics.length > 0 && (
        <div className="bg-mirai-topics-section py-10">
          <Container>
            <TopicsSection topics={topics} />
          </Container>
        </div>
      )}

      {/* 過去の議会セクション（Archive） */}
      {previousSessionData.length > 0 && (
        <div className="bg-mirai-surface-muted py-10">
          <Container>
            <div className="flex flex-col gap-16">
              {previousSessionData.map((data, index) => (
                <PreviousSessionSection
                  key={data.session.id}
                  session={data.session}
                  bills={data.bills}
                  totalBillCount={data.totalBillCount}
                  showArchiveHeader={index === 0}
                />
              ))}
            </div>
          </Container>
        </div>
      )}

      <Container>
        {/* みらい議会とは セクション */}
        <About />

        {/* チームみらいについて セクション */}
        <TeamMirai />

        {/* AFTTTについて セクション */}
        <AFTTT />

        {/* 免責事項 */}
        <BillDisclaimer />
      </Container>

      {/* チャット機能 */}
      <HomeChatClient
        currentDifficulty={difficultyLevel}
        bills={sessionBills.map(toBillChatContext)}
      />
    </>
  );
}
