import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const tempDirs = [];

function makeTempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "utterance-index-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeFixture({ fullText }) {
  const tempDir = makeTempDir();
  const publicJsonPath = path.join(tempDir, "general-questions.json");
  const minutesRoot = path.join(tempDir, "minutes");
  const outputPath = path.join(tempDir, "utterances.json");
  const minutesDir = path.join(minutesRoot, "2026-06-15");
  const minutesFilePath = path.join(
    minutesDir,
    "石垣市議会 令和8年6月15日 6月定例会 テスト太郎議員 一般質問_minutes.md"
  );

  mkdirSync(minutesDir, { recursive: true });
  writeFileSync(
    publicJsonPath,
    `${JSON.stringify(
      {
        diet_session_slug: "ishigaki-r8-dai4-teireikai",
        questions: [
          {
            slug: "test-question",
            question_date: "2026-06-15",
            member_name_raw: "テスト太郎",
            items: [
              {
                item_number: 1,
                title: "テスト項目について",
                sub_items: [],
              },
              {
                item_number: 2,
                title: "追加項目について",
                sub_items: [],
              },
            ],
          },
        ],
      },
      null,
      2
    )}\n`
  );
  writeFileSync(minutesFilePath, `# minutes\n\n## 本文 / full_text\n${fullText}\n`);

  execFileSync(
    "node",
    [
      path.join(ROOT, "scripts/issue-publisher/build-utterance-index.mjs"),
      "--public-json",
      publicJsonPath,
      "--minutes-root",
      minutesRoot,
      "--output",
      outputPath,
    ],
    { cwd: ROOT, stdio: "pipe" }
  );

  return JSON.parse(readFileSync(outputPath, "utf8"));
}

describe("build-utterance-index speaker attribution provenance", () => {
  test("uses a swallowed explicit role/name cue as the next utterance boundary", () => {
    const payload = writeFixture({
      fullText: [
        "会計監査吉村吉君",
        "テスト太郎議員の1項目目、テスト項目についてお答えします。",
        "以上です。",
        "企画部長 菅沼博彦",
        "テスト太郎議員の2項目目、追加項目についてお答えします。",
      ].join("\n"),
    });

    expect(payload.utterances).toHaveLength(2);
    expect(payload.utterances[0].text).not.toContain("企画部長 菅沼博彦");
    expect(payload.utterances[0]).toMatchObject({
      speaker_hint: "会計監査吉村吉",
      speaker_role_hint: "unknown",
    });
    expect(payload.utterances[1]).toMatchObject({
      speaker_hint: "企画部長 菅沼博彦",
      speaker_role_hint: "executive",
      speaker_attribution: {
        raw_cue: "企画部長 菅沼博彦",
        normalized_name: "企画部長 菅沼博彦",
        normalized_role: "executive",
        method: "explicit",
        confidence: "explicit",
        unresolved_reason: null,
      },
    });
    expect(payload.utterances[1].speaker_attribution.evidence).toEqual([
      {
        kind: "speaker_cue",
        text: "企画部長 菅沼博彦",
        line_number: 4,
      },
    ]);
  });

  test("does not treat role words inside ordinary prose as a speaker cue", () => {
    const payload = writeFixture({
      fullText: [
        "テスト太郎議員の1項目目、テスト項目について質問します。",
        "市長の見解を伺います。",
      ].join("\n"),
    });

    expect(payload.utterances).toHaveLength(1);
    expect(payload.utterances[0].text).toContain("市長の見解を伺います。");
    expect(payload.utterances[0]).toMatchObject({
      speaker_hint: "テスト太郎",
      speaker_role_hint: "questioner",
      speaker_attribution: {
        raw_cue: null,
        method: "explicit",
        confidence: "explicit",
      },
    });
  });

  test("records explicit executive cue without changing speaker fields", () => {
    const payload = writeFixture({
      fullText: [
        "建設部長 下地俊一君",
        "テスト太郎議員の1項目目、テスト項目についてお答えします。",
      ].join("\n"),
    });

    expect(payload.utterances).toHaveLength(1);
    expect(payload.utterances[0]).toMatchObject({
      speaker_hint: "建設部長 下地俊一",
      speaker_role_hint: "executive",
      speaker_attribution: {
        raw_cue: "建設部長 下地俊一君",
        normalized_name: "建設部長 下地俊一",
        normalized_role: "executive",
        method: "explicit",
        confidence: "explicit",
        unresolved_reason: null,
      },
    });
    expect(payload.utterances[0].speaker_attribution.evidence).toEqual([
      {
        kind: "speaker_cue",
        text: "建設部長 下地俊一君",
        line_number: 1,
      },
    ]);
  });

  test("keeps unknown speaker unknown while preserving the raw cue", () => {
    const payload = writeFixture({
      fullText: [
        "総務省田原治君",
        "テスト太郎議員の1項目目、テスト項目についてお答えします。",
      ].join("\n"),
    });

    expect(payload.utterances).toHaveLength(1);
    expect(payload.utterances[0]).toMatchObject({
      speaker_hint: "総務省田原治",
      speaker_role_hint: "unknown",
      speaker_attribution: {
        raw_cue: "総務省田原治君",
        normalized_name: "総務省田原治",
        normalized_role: "unknown",
        method: "unknown",
        confidence: "unknown",
      },
    });
    expect(
      payload.utterances[0].speaker_attribution.unresolved_reason
    ).toContain("did not match");
  });

  test("uses null raw cue when the current speaker came from question metadata", () => {
    const payload = writeFixture({
      fullText: "テスト太郎議員の1項目目、テスト項目について質問します。",
    });

    expect(payload.utterances).toHaveLength(1);
    expect(payload.utterances[0]).toMatchObject({
      speaker_hint: "テスト太郎",
      speaker_role_hint: "questioner",
      speaker_attribution: {
        raw_cue: null,
        normalized_name: "テスト太郎",
        normalized_role: "questioner",
        method: "explicit",
        confidence: "explicit",
        unresolved_reason: null,
      },
    });
  });
});
