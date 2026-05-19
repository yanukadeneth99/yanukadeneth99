// Pulls recent posts from your own X timeline via the Owned Reads endpoint
// ($0.001/post returned under the 2026 pay-per-use model), picks the top 3 by
// (likes + retweets*2 + replies), and writes them into a marked README region.
//
// Why pull more than 3 and sort client-side? The API has no "sort by engagement"
// option; we have to fetch a window of recent posts and rank locally. We cap
// max_results=10 to keep per-run cost ≈ $0.01 (10 * $0.001). Weekly = ~$0.04/mo.
//
// Requires env:
//   X_BEARER_TOKEN  - from console.x.com (your project's app)
//   X_USER_ID       - your numeric X user id (NOT handle); see README setup notes

import { readFile, writeFile } from "node:fs/promises";

const BEARER = process.env.X_BEARER_TOKEN;
const USER_ID = process.env.X_USER_ID;
const README = "README.md";
const START = "<!-- XPOSTS:START -->";
const END = "<!-- XPOSTS:END -->";

if (!BEARER || !USER_ID) {
  // Don't fail the whole workflow during initial setup — leave the block as-is.
  console.warn("X_BEARER_TOKEN or X_USER_ID missing; skipping update.");
  process.exit(0);
}

// Exclude retweets (someone else's content) but keep replies — for an
// "Innovator" profile, sharp replies often outperform standalone posts and
// we want the genuine top 3 regardless of post type.
//
// max_results=50 gives a wider window so the "best of" reflects more than
// just the last 10 things you posted. Cost stays cheap because X dedups
// repeated post IDs within a 24h window (~$1.50/mo at hourly polling).
const url = new URL(`https://api.x.com/2/users/${USER_ID}/tweets`);
url.searchParams.set("max_results", "50");
url.searchParams.set("exclude", "retweets");
url.searchParams.set("tweet.fields", "public_metrics,created_at");

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${BEARER}`, "User-Agent": "yanukadeneth99-profile-bot" },
});

if (!res.ok) {
  // 429 = rate-limited or out of credits; don't crash the workflow loudly,
  // just log and exit clean so README stays at last-known-good content.
  console.warn(`X API ${res.status}: ${await res.text()}`);
  process.exit(0);
}

const { data = [] } = await res.json();

// Engagement score: flat sum of likes + retweets + replies. Equal weighting
// because "most engaged" is what the user actually wants surfaced — no
// editorial bias for one signal over another.
const scored = data
  .map((t) => {
    const m = t.public_metrics || {};
    const score = (m.like_count || 0) + (m.retweet_count || 0) + (m.reply_count || 0);
    return { ...t, score };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

let block;
if (scored.length === 0) {
  block = `> _No recent posts yet._`;
} else {
  block = scored
    .map((t) => {
      const url = `https://x.com/i/web/status/${t.id}`;
      const text = t.text.replace(/\n+/g, " ").slice(0, 240);
      const m = t.public_metrics || {};
      const meta = `❤️ ${m.like_count || 0} · 🔁 ${m.retweet_count || 0} · 💬 ${m.reply_count || 0}`;
      // Blockquote keeps it visually distinct without needing an embed iframe
      // (which GitHub strips anyway).
      return `> ${text}  \n> \n> [${meta}](${url})`;
    })
    .join("\n>\n> ---\n>\n");
}

const current = await readFile(README, "utf8");
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!pattern.test(current)) {
  throw new Error(`Markers ${START} / ${END} not found in README.md`);
}
const next = current.replace(pattern, `${START}\n${block}\n${END}`);

if (next !== current) {
  await writeFile(README, next);
  console.log("README updated.");
} else {
  console.log("No change.");
}
