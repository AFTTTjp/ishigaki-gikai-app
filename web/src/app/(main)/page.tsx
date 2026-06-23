import { Container } from "@/components/layouts/container";
import { About } from "@/components/top/about";
import { AFTTT } from "@/components/top/afttt";
import { ComingSoonSection } from "@/components/top/coming-soon-section";
import { Hero } from "@/components/top/hero";
import { TeamMirai } from "@/components/top/team-mirai";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { BillDisclaimer } from "@/features/bills/client/components/bill-detail/bill-disclaimer";
import { BillsByTagSection } from "@/features/bills/server/components/bills-by-tag-section";
import { FeaturedBillSection } from "@/features/bills/server/components/featured-bill-section";
import { PreviousSessionSection } from "@/features/bills/server/components/previous-session-section";
import { getBillsByDietSession } from "@/features/bills/server/loaders/get-bills-by-diet-session";
import { loadHomeData } from "@/features/bills/server/loaders/load-home-data";
import type { BillWithContent } from "@/features/bills/shared/types";
import { getBillDisplayTitle } from "@/features/bills/shared/utils/bill-title";
import { HomeChatClient } from "@/features/chat/client/components/home-chat-client";
import { CurrentDietSession } from "@/features/diet-sessions/client/components/current-diet-session";
import { DietSessionFeaturedBillsSection } from "@/features/diet-sessions/client/components/diet-session-featured-bills-section";
import { DietSessionKeyPointsSection } from "@/features/diet-sessions/client/components/diet-session-key-points-section";
import { DietSessionOverviewSection } from "@/features/diet-sessions/client/components/diet-session-overview-section";
import { getActiveDietSession } from "@/features/diet-sessions/server/loaders/get-active-diet-session";
import { getCurrentDietSession } from "@/features/diet-sessions/server/loaders/get-current-diet-session";
import { getAllPreviousDietSessions } from "@/features/diet-sessions/server/loaders/get-previous-diet-session";
import { SESSION_OVERVIEWS } from "@/features/diet-sessions/shared/data/session-overviews";
import { selectFeaturedBills } from "@/features/diet-sessions/shared/utils/select-featured-bills";
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
  const { billsByTag, featuredBills, comingSoonBills, previousSessionData } =
    await loadHomeData({
      difficultyLevel,
      activeDietSessionId: activeSession?.id ?? null,
      previousSessions,
    });

  // 「今会期の注目議案」: 現会期の議案から featuredBillNumbers で抽出（番号一致・fuzzyなし）。
  // 指定が無い会期では DB を引かない。
  const featuredBillNumbers = currentSession?.slug
    ? (SESSION_OVERVIEWS[currentSession.slug]?.featuredBillNumbers ?? [])
    : [];
  const featuredSessionBills =
    currentSession && featuredBillNumbers.length > 0
      ? selectFeaturedBills(
          featuredBillNumbers,
          await getBillsByDietSession(currentSession.id)
        )
      : [];

  const toBillChatContext = (bill: BillWithContent) => {
    return {
      name: getBillDisplayTitle(bill),
      summary: bill.bill_content?.summary,
      tags: bill.tags?.map((tag) => tag.label) || [],
      isFeatured: featuredBills.some((b) => b.id === bill.id),
    };
  };

  return (
    <>
      <Hero />

      {/* 本日の議会セクション */}
      <CurrentDietSession session={currentSession} />

      {/* 今会期で議論されていること（現在地の一言＋論点カード・トップの主役） */}
      <DietSessionKeyPointsSection session={currentSession} />

      {/* 今会期の注目議案（議案詳細への直接導線。対象が無ければ非表示） */}
      <DietSessionFeaturedBillsSection bills={featuredSessionBills} />

      {/* 議案のカテゴリ別一覧（論点カードの補足。トップでは見出しを弱める） */}
      <DietSessionOverviewSection session={currentSession} />

      {topics.length > 0 && (
        <div className="bg-mirai-topics-section py-10">
          <Container>
            <TopicsSection topics={topics} />
          </Container>
        </div>
      )}

      {/* 議案一覧セクション */}
      <Container className="">
        <div className="py-10">
          <main className="flex flex-col gap-16">
            {/* 注目の議案セクション */}
            <FeaturedBillSection bills={featuredBills} />

            {/* タグ別議案一覧セクション */}
            <BillsByTagSection billsByTag={billsByTag} />

            {/* Coming soonセクション（coming_soon 議案が0件なら非表示） */}
            {comingSoonBills.length > 0 && (
              <ComingSoonSection bills={comingSoonBills} />
            )}
          </main>
        </div>
      </Container>

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
        bills={billsByTag
          .flatMap((x) => x.bills)
          .concat(featuredBills)
          .map(toBillChatContext)}
      />
    </>
  );
}
