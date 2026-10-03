import Image from "next/image";
import type { Route } from "next";
import { MapPin, Shield, Users } from "lucide-react";
import Link from "next/link";
import type { Member } from "@/features/members/shared/types";
import {
  getMemberLinkPresentation,
  getMemberLinks,
} from "@/features/members/shared/utils/member-link";
import { routes } from "@/lib/routes";

function formatBirthDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();

  return `${year}年生`;
}

function formatElectionCount(value: number | null) {
  if (value == null) return "当選回数未登録";
  return `当選${value}回`;
}

export function MemberCard({ member }: { member: Member }) {
  const birthDate = formatBirthDate(member.birth_date);
  const memberLinks = getMemberLinks(member);

  return (
    <Link
      href={routes.memberDetail(member.id) as Route}
      className="block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="border-b border-slate-100 bg-white px-5 py-5">
          <div className="space-y-3">
            <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
              {formatElectionCount(member.election_count)}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-[0.02em] text-slate-900">
                {member.name}
              </h2>
              <p className="text-sm font-medium text-slate-500">
                {member.name_kana || "ふりがな未登録"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="grid gap-3 text-sm leading-6 text-slate-700">
            <div className="flex items-start gap-2">
              <Shield className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                  政党
                </div>
                <div>{member.party || "未登録"}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Users className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                  会派
                </div>
                <div>{member.party_group || "未登録"}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                  住所
                </div>
                <div>{member.address || "未登録"}</div>
              </div>
            </div>
          </div>

          {birthDate ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {birthDate}
            </div>
          ) : null}

          {memberLinks.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              {memberLinks.map((link) => {
                const icon = getMemberLinkPresentation(link.service);

                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={link.label || icon.name}
                    className="transition-opacity hover:opacity-70"
                  >
                    <Image
                      src={icon.iconPath}
                      alt={link.label || icon.name}
                      width={36}
                      height={36}
                      className={
                        icon.hasBorder
                          ? "rounded-full border border-mirai-border-light"
                          : ""
                      }
                    />
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
