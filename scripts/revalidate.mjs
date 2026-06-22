// NOTE: web/src/lib/cache-tags.ts の CACHE_TAGS と必ず同期させること。
// 新しいキャッシュタグを追加したら、この配列にも追加する。
// （.mjs から TS を import できないため手動同期。漏れると --all でそのタグが
//  revalidate されず、本番のキャッシュが古いまま残る。）
const ALL_TAGS = [
  "bills",
  "council-actions",
  "diet-sessions",
  "general-questions",
  "interview-configs",
  "topics",
];

function printUsage() {
  console.log(`Usage (run via node; there is no "pnpm revalidate" script):
  dotenv -e <envfile> -- node scripts/revalidate.mjs --all
  dotenv -e <envfile> -- node scripts/revalidate.mjs topics
  dotenv -e <envfile> -- node scripts/revalidate.mjs bills topics
  dotenv -e .env.prod -- node scripts/revalidate.mjs --url https://ishigaki-gikai-app-web-coral.vercel.app topics

Env vars (from <envfile>):
  REVALIDATE_SECRET           Bearer secret. MUST match the target deployment's secret (mismatch => 401).
  WEB_URL | NEXT_PUBLIC_WEB_URL  Target base URL (or pass --url).

Important (do not mix test/prod):
  The <envfile> REVALIDATE_SECRET and the target URL must belong to the SAME deployment.
  prod: .env.prod + prod URL (e.g. https://ishigaki-gikai-app-web-coral.vercel.app)
  test: .env.test + test URL. Mixing them returns 401 Unauthorized.

Options:
  --all           Revalidate all cache tags
  --url <url>     Override target base URL
  --help          Show this message

Available tags:
  ${ALL_TAGS.join(", ")}
`);
}

function parseArgs(argv) {
  const args = [...argv];
  let url = process.env.WEB_URL || process.env.NEXT_PUBLIC_WEB_URL;
  let useAll = false;
  const tags = [];

  while (args.length > 0) {
    const arg = args.shift();

    if (!arg) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--all") {
      useAll = true;
      continue;
    }

    if (arg === "--url") {
      url = args.shift();
      continue;
    }

    tags.push(arg);
  }

  if (!url) {
    throw new Error(
      "Target URL is not set. Configure WEB_URL or NEXT_PUBLIC_WEB_URL, or pass --url."
    );
  }

  const invalidTags = tags.filter((tag) => !ALL_TAGS.includes(tag));
  if (invalidTags.length > 0) {
    throw new Error(
      `Unknown cache tag: ${invalidTags.join(", ")}. Available tags: ${ALL_TAGS.join(", ")}`
    );
  }

  if (!useAll && tags.length === 0) {
    throw new Error("Specify at least one cache tag, or use --all.");
  }

  return {
    url: url.replace(/\/$/, ""),
    tags: useAll ? ALL_TAGS : tags,
  };
}

async function main() {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    throw new Error("REVALIDATE_SECRET is not set.");
  }

  const { url, tags } = parseArgs(process.argv.slice(2));

  const response = await fetch(`${url}/api/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ tags }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Revalidate failed (${response.status}): ${text}`);
  }

  console.log(text);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
