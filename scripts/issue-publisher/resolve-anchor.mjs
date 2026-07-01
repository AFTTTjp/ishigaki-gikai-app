#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

function isCliEntry() {
  return path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
}

export function loadUtteranceIndex(indexPath) {
  const parsed = JSON.parse(readFileSync(indexPath, "utf8"));
  if (parsed.schema_version !== "issue-publisher-utterance-index.v1") {
    throw new Error(`Unsupported schema_version: ${parsed.schema_version}`);
  }
  if (!Array.isArray(parsed.utterances)) {
    throw new Error("utterances must be an array");
  }
  return parsed;
}

export function resolveAnchor(index, anchor) {
  const matches = [];

  for (const utterance of index.utterances) {
    if (utterance.utterance_id === anchor) {
      matches.push({
        resolved_by: "utterance_id",
        utterance,
      });
      continue;
    }

    if ((utterance.anchor_aliases ?? []).includes(anchor)) {
      matches.push({
        resolved_by: "anchor_alias",
        utterance,
      });
    }
  }

  if (matches.length === 0) {
    return {
      ok: false,
      anchor,
      error: {
        code: "ANCHOR_NOT_FOUND",
        message: `Anchor not found: ${anchor}`,
      },
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      anchor,
      error: {
        code: "DUPLICATE_ANCHOR",
        message: `Anchor resolves to multiple utterances: ${anchor}`,
      },
      matches: matches.map((match) => match.utterance.utterance_id),
    };
  }

  const resolved = matches[0];
  return {
    ok: true,
    anchor,
    resolved_by: resolved.resolved_by,
    utterance: resolved.utterance,
    source_locator: {
      source_type: resolved.utterance.source_type,
      source_minutes_file: resolved.utterance.source_minutes_file,
      question_slug: resolved.utterance.question_slug,
      line_start: resolved.utterance.line_start,
      line_end: resolved.utterance.line_end,
    },
  };
}

function main() {
  const [, , indexPathArg, anchor] = process.argv;
  if (!indexPathArg || !anchor) {
    console.error(
      "Usage: node scripts/issue-publisher/resolve-anchor.mjs <index-json> <anchor>"
    );
    process.exitCode = 1;
    return;
  }

  const indexPath = resolve(indexPathArg);
  const index = loadUtteranceIndex(indexPath);
  const result = resolveAnchor(index, anchor);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

if (isCliEntry()) {
  main();
}
