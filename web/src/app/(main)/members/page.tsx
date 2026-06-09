import { Container } from "@/components/layouts/container";
import { MemberCard } from "@/components/members/member-card";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { PageChatClient } from "@/features/chat/client/components/page-chat-client";
import { getMembers } from "@/features/members/server/repositories/member-repository";

export const metadata = {
  title: "議員名簿 | みらい議会@石垣市",
};

export default async function MembersPage() {
  const [members, currentDifficulty] = await Promise.all([
    getMembers(),
    getDifficultyLevel(),
  ]);

  return (
    <div
      className="pb-32 pt-10 md:pb-10"
      style={{
        backgroundImage:
          "linear-gradient(var(--color-stance-for-badge-start), var(--color-stance-for-badge-end))",
      }}
    >
      <Container>
        <div className="flex flex-col gap-8">
          <div className="space-y-3">
            <p className="text-sm font-bold tracking-[0.08em] text-primary-accent">
              MEMBERS
            </p>
            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold tracking-[0.02em] text-slate-900">
                石垣市議会 議員名簿
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-600">
                石垣市議会の議員情報を一覧で確認できます。所属政党、会派、当選回数などを掲載しています。
              </p>
            </div>
          </div>

          {members.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {members.map((member, index) => (
                <MemberCard
                  key={`${member.name}-${member.birth_date ?? index}`}
                  member={member}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 shadow-sm">
              現在、表示できる議員データがありません。
            </div>
          )}
        </div>
      </Container>
      <PageChatClient
        currentDifficulty={currentDifficulty}
        items={members.map((member) => ({
          name: member.name,
          summary: [
            member.party || "政党未登録",
            member.party_group || "会派未登録",
            member.election_count != null
              ? `当選${member.election_count}回`
              : "",
          ]
            .filter(Boolean)
            .join(" / "),
          tags: ["議員名簿"],
        }))}
      />
    </div>
  );
}
