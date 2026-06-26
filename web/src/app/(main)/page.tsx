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
import { DietSessionBillGroupsSection } from "@/features/diet-sessions/client/components/diet-session-bill-groups-section";
import { DietSessionKeyPointsSection } from "@/features/diet-sessions/client/components/diet-session-key-points-section";
import { DietSessionOverviewSection } from "@/features/diet-sessions/client/components/diet-session-overview-section";
import { getActiveDietSession } from "@/features/diet-sessions/server/loaders/get-active-diet-session";
import { getCurrentDietSession } from "@/features/diet-sessions/server/loaders/get-current-diet-session";
import { getAllPreviousDietSessions } from "@/features/diet-sessions/server/loaders/get-previous-diet-session";
import { SESSION_OVERVIEWS } from "@/features/diet-sessions/shared/data/session-overviews";
import {
  buildBillIdByNumber,
  selectFeaturedBillGroups,
} from "@/features/diet-sessions/shared/utils/select-featured-bills";
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

  // 会期終了後もトップに直近会期の議案導線を残すため、開催中の会期（currentSession）が
  // 無ければ is_active 会期（activeSession）へフォールバックする表示用セッション。
  // ※ CurrentDietSession バナーは日付基準を保つため currentSession のまま（下記参照）。
  const displaySession = currentSession ?? activeSession;

  // 表示会期の公開済み議案（本文あり）を1回だけ取得し、
  // 「分野別に見る 今会期の議案」と「今会期の議案テーマ一覧」の両方で使う。
  const sessionBills = displaySession
    ? await getBillsByDietSession(displaySession.id)
    : [];

  // 「分野別に見る 今会期の議案」: featuredBillGroups で分野別に解決（番号一致・fuzzyなし）。
  const featuredBillGroups = displaySession?.slug
    ? (SESSION_OVERVIEWS[displaySession.slug]?.featuredBillGroups ?? [])
    : [];
  const sessionBillGroups =
    featuredBillGroups.length > 0
      ? selectFeaturedBillGroups(featuredBillGroups, sessionBills)
      : [];

  // 「今会期の議案テーマ一覧」のバッジを議案詳細へリンクするための番号→id対応表。
  const billIdByNumber = buildBillIdByNumber(sessionBills);
  const availableTopicSlugs = topics.map((topic) => topic.slug);

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

      {/* 本日の議会セクション（バナーは日付基準。閉会後は「開催なし」を維持） */}
      <CurrentDietSession session={currentSession} />

      {/* 今会期で議論されていること（現在地の一言＋論点カード・トップの主役） */}
      <DietSessionKeyPointsSection
        session={displaySession}
        availableTopicSlugs={availableTopicSlugs}
      />

      {/* 分野別に見る 今会期の議案（議案詳細への直接導線。対象が無ければ非表示） */}
      <DietSessionBillGroupsSection groups={sessionBillGroups} />

      {/* 議案のカテゴリ別一覧（論点カードの補足。トップでは見出しを弱める） */}
      <DietSessionOverviewSection
        session={displaySession}
        billIdByNumber={billIdByNumber}
      />

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
