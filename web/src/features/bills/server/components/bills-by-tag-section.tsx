import type { Route } from "next";
import Link from "next/link";
import { routes } from "@/lib/routes";
import type { BillsByTag } from "../../shared/types";
import { shuffleArray } from "../../shared/utils/shuffle-array";
import { getTagIcon } from "../../shared/utils/tag-icon";
import { BillCard } from "../../client/components/bill-list/bill-card";

interface BillsByTagSectionProps {
  billsByTag: BillsByTag[];
}

export function BillsByTagSection({ billsByTag }: BillsByTagSectionProps) {
  if (billsByTag.length === 0) {
    return null;
  }

  const shuffledBillsByTag = shuffleArray(billsByTag);

  return (
    <div className="flex flex-col gap-12">
      {shuffledBillsByTag.map(({ tag, bills }) => {
        const tagIcon = getTagIcon(tag.label);

        return (
          <section key={tag.id} className="flex flex-col gap-6">
            {/* タグヘッダー */}
            <div className="flex flex-col gap-1.5">
              <h2 className="flex items-center gap-1.5 text-[22px] font-bold leading-[1.48] text-black">
                <span>{tag.label}</span>
                {tagIcon ? (
                  <span aria-hidden="true" className="text-[24px] leading-none">
                    {tagIcon}
                  </span>
                ) : null}
              </h2>
              {tag.description && (
                <p className="text-xs text-mirai-text-secondary">
                  {tag.description}
                </p>
              )}
            </div>

            {/* 議案カード一覧 */}
            <div className="flex flex-col gap-4">
              {bills.map((bill) => (
                <Link key={bill.id} href={routes.billDetail(bill.id) as Route}>
                  <BillCard bill={bill} />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
