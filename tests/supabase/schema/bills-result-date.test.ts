import { afterEach, describe, expect, it } from "vitest";
import { adminClient, cleanupTestBill } from "../utils";

const createdBillIds: string[] = [];

afterEach(async () => {
  for (const billId of createdBillIds) {
    await cleanupTestBill(billId);
  }
  createdBillIds.length = 0;
});

describe("bills.result_date", () => {
  it("既存互換のため未指定時はNULL", async () => {
    const { data, error } = await adminClient
      .from("bills")
      .insert({
        name: `result_date null test ${Date.now()}`,
        originating_house: "HR",
        status: "introduced",
        publish_status: "draft",
      })
      .select("id, result_date")
      .single();

    expect(error).toBeNull();
    expect(data?.result_date).toBeNull();

    if (data) createdBillIds.push(data.id);
  });

  it("一次資料で確認した採決日をdateとして保存できる", async () => {
    const { data, error } = await adminClient
      .from("bills")
      .insert({
        name: `result_date value test ${Date.now()}`,
        originating_house: "HR",
        status: "enacted",
        publish_status: "draft",
        result_date: "2099-06-24",
      })
      .select("id, result_date")
      .single();

    expect(error).toBeNull();
    expect(data?.result_date).toBe("2099-06-24");

    if (data) createdBillIds.push(data.id);
  });
});
