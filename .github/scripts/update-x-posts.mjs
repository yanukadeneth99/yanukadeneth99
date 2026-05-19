// Generates ONE SVG per top tweet at .github/assets/x-posts/<id>.svg, then
// writes a README block with three <a href="tweet-url"><img></a> blocks so
// each card is individually clickable. (GitHub strips <a> tags inside SVGs
// served as <img>, so per-region linking only works via separate files.)
//
// Cost model:
//  - Tweets endpoint: 50 posts × $0.001, hourly, dedup'd within 24h → ~$1.50/mo
//  - User endpoint (avatar): cached 7 days → ~$0.004/mo

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Buffer } from "node:buffer";

const BEARER = process.env.X_BEARER_TOKEN;
const USER_ID = process.env.X_USER_ID;
const README = "README.md";
const ASSETS_DIR = ".github/assets/x-posts";
const CACHE_PATH = ".github/data/x-cache.json";
const START = "<!-- XPOSTS:START -->";
const END = "<!-- XPOSTS:END -->";

const AVATAR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

if (!BEARER || !USER_ID) {
  console.warn("X_BEARER_TOKEN or X_USER_ID missing; skipping update.");
  process.exit(0);
}

const headers = {
  Authorization: `Bearer ${BEARER}`,
  "User-Agent": "yanukadeneth99-profile-bot",
};

// ─── Avatar caching ─────────────────────────────────────────────────────────

async function loadCache() {
  if (!existsSync(CACHE_PATH)) return null;
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function saveCache(cache) {
  await mkdir(".github/data", { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function getProfile() {
  const cache = await loadCache();
  const stale =
    !cache?.avatar || Date.now() - new Date(cache.fetchedAt || 0).getTime() > AVATAR_TTL_MS;
  if (!stale) return cache;

  const res = await fetch(
    `https://api.x.com/2/users/${USER_ID}?user.fields=profile_image_url,name,username`,
    { headers },
  );
  if (!res.ok) {
    console.warn(`User lookup ${res.status}: ${await res.text()}`);
    return cache;
  }
  const { data } = await res.json();

  const imgUrl = (data.profile_image_url || "").replace("_normal", "");
  let avatar = cache?.avatar || null;
  if (imgUrl) {
    try {
      const imgRes = await fetch(imgUrl);
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const mime = imgRes.headers.get("content-type") || "image/jpeg";
        avatar = `data:${mime};base64,${buf.toString("base64")}`;
      }
    } catch (e) {
      console.warn("Avatar fetch failed:", e.message);
    }
  }

  const next = {
    avatar,
    name: data.name,
    username: data.username,
    fetchedAt: new Date().toISOString(),
  };
  await saveCache(next);
  return next;
}

// ─── Tweets ─────────────────────────────────────────────────────────────────

async function getTopTweets() {
  const url = new URL(`https://api.x.com/2/users/${USER_ID}/tweets`);
  url.searchParams.set("max_results", "50");
  url.searchParams.set("exclude", "retweets");
  url.searchParams.set("tweet.fields", "public_metrics,created_at");

  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.warn(`Tweets ${res.status}: ${await res.text()}`);
    return [];
  }
  const { data = [] } = await res.json();
  return data
    .map((t) => {
      const m = t.public_metrics || {};
      return {
        ...t,
        likes: m.like_count || 0,
        retweets: m.retweet_count || 0,
        replies: m.reply_count || 0,
        score: (m.like_count || 0) + (m.retweet_count || 0) + (m.reply_count || 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ─── Text utilities ─────────────────────────────────────────────────────────

function xml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Tokenize a wrapped line so @mentions and #hashtags get rendered in the
// accent purple — same convention X uses in its own UI. SVG nested <tspan>
// inherits position from the parent <text> and only overrides fill, so we
// don't need to recompute x/y per token. All non-token text still flows
// inline with normal whitespace.
function colorizeLine(line, accent) {
  // Split on whitespace-prefixed @/# tokens, keeping the prefix as part of
  // the captured group so we don't lose leading spaces between words.
  const parts = line.split(/(\s*[@#][A-Za-z0-9_]+)/g);
  return parts
    .map((part) => {
      const m = part.match(/^(\s*)([@#][A-Za-z0-9_]+)$/);
      if (m) return `${xml(m[1])}<tspan fill="${accent}">${xml(m[2])}</tspan>`;
      return xml(part);
    })
    .join("");
}

// Card text area = 880 - 18*2 padding - 40 avatar - 14 gutter = 790px.
// At 15px font ≈ 7.5px/char average → ~105 chars max. 95 gives safety margin
// for wider glyphs (M, W, capitalized handles) without producing cramped lines.
function wrapText(text, maxChars = 95) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }
    if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 4) {
    lines.length = 4;
    lines[3] = lines[3].replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

function relTime(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtCount(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "") + "K";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

// ─── SVG building ───────────────────────────────────────────────────────────

// Card uses X's native dark palette so it reads as a tweet, but the avatar
// fallback ring picks up the site's purple accent — the colour story ties
// back to the brand even when the real avatar fails to load.
const COLOR = {
  bg: "#000000",
  text: "#E7E9EA",
  muted: "#71767B",
  separator: "rgba(255,255,255,0.12)",
  accent: "#A371F7", // site purple
};

const ICONS = {
  reply: `<path d="M3 4.5C3 3.12 4.12 2 5.5 2h7C13.88 2 15 3.12 15 4.5v6c0 1.38-1.12 2.5-2.5 2.5H9.5L6 16v-3H5.5C4.12 13 3 11.88 3 10.5v-6z"/>`,
  retweet: `<path d="M5 4h7v2H6.5l1 1L6 8.5 3 6l3-2.5L7 4.5 5 4zm8 10H6v-2h7l-1-1 1.5-1.5L17 12l-3 2.5-1-1L13 14z"/>`,
  like: `<path d="M9 15.5l-.95-.86C4.4 11.36 2 9.28 2 6.5 2 4.42 3.42 3 5.5 3c1.16 0 2.28.54 3 1.39C9.22 3.54 10.34 3 11.5 3 13.58 3 15 4.42 15 6.5c0 2.78-2.4 4.86-6.05 8.14L9 15.5z"/>`,
};

const CARD = {
  width: 880, // full-width target to fit the README content area on desktop
  paddingX: 18,
  paddingTop: 16,
  paddingBottom: 16,
  avatarSize: 40,
  avatarGutter: 14,
  bodyLineHeight: 20,
  bodyTopGap: 22,
  engagementTopGap: 16,
  engagementHeight: 18,
};

function tweetSvg(tweet, profile, idx) {
  const lines = wrapText(tweet.text);

  const contentX = CARD.paddingX + CARD.avatarSize + CARD.avatarGutter;
  const headerY = CARD.paddingTop + 20;
  const bodyStartY = headerY + CARD.bodyTopGap;
  const engagementY = bodyStartY + (lines.length - 1) * CARD.bodyLineHeight + CARD.engagementTopGap;
  const cardHeight = engagementY + CARD.engagementHeight + CARD.paddingBottom;

  const handle = `@${profile.username || "yanukadeneth99"}`;
  const name = profile.name || "YASHURA";
  const time = relTime(tweet.created_at);

  const cx = CARD.paddingX + CARD.avatarSize / 2;
  const cy = CARD.paddingTop + CARD.avatarSize / 2;
  const avatarClipId = `ava-${idx}`;
  const avatar = profile.avatar
    ? `<clipPath id="${avatarClipId}"><circle cx="${cx}" cy="${cy}" r="${CARD.avatarSize / 2}"/></clipPath>
       <image href="${profile.avatar}" x="${CARD.paddingX}" y="${CARD.paddingTop}" width="${CARD.avatarSize}" height="${CARD.avatarSize}" clip-path="url(#${avatarClipId})" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${CARD.avatarSize / 2}" fill="${COLOR.accent}"/>
       <text x="${cx}" y="${cy + 6}" font-size="18" font-weight="700" text-anchor="middle" fill="#fff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Y</text>`;

  const header = `<text x="${contentX}" y="${headerY}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15">
      <tspan font-weight="700" fill="${COLOR.text}">${xml(name)}</tspan>
      <tspan fill="${COLOR.muted}">  ${xml(handle)} · ${xml(time)}</tspan>
    </text>`;

  // colorizeLine does its own xml() per part, so we don't double-escape here.
  const bodyTspans = lines
    .map(
      (ln, i) =>
        `<tspan x="${contentX}" dy="${i === 0 ? 0 : CARD.bodyLineHeight}">${colorizeLine(ln, COLOR.accent)}</tspan>`,
    )
    .join("");
  const body = `<text x="${contentX}" y="${bodyStartY}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" fill="${COLOR.text}">${bodyTspans}</text>`;

  const engagement = [
    { icon: ICONS.reply, count: fmtCount(tweet.replies) },
    { icon: ICONS.retweet, count: fmtCount(tweet.retweets) },
    { icon: ICONS.like, count: fmtCount(tweet.likes) },
  ]
    .map(({ icon, count }, i) => {
      const gx = contentX + i * 100;
      return `<g transform="translate(${gx}, ${engagementY})" fill="${COLOR.muted}">
        ${icon}
        <text x="26" y="13" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="${COLOR.muted}">${xml(count)}</text>
      </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${cardHeight}" viewBox="0 0 ${CARD.width} ${cardHeight}" role="img" aria-label="${xml(name)} on X">
  <rect width="${CARD.width}" height="${cardHeight}" fill="${COLOR.bg}" rx="14"/>
  <rect x="0.5" y="0.5" width="${CARD.width - 1}" height="${cardHeight - 1}" fill="none" stroke="${COLOR.separator}" stroke-width="1" rx="14"/>
  ${avatar}
  ${header}
  ${body}
  ${engagement}
</svg>`;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const [profile, tweets] = await Promise.all([getProfile(), getTopTweets()]);

await mkdir(ASSETS_DIR, { recursive: true });

// Wipe stale SVGs from previous runs so we don't accumulate old tweet files
// after the top-3 ranking shifts. The directory stays trivially small.
for (const f of await readdir(ASSETS_DIR)) {
  if (f.endsWith(".svg")) await rm(`${ASSETS_DIR}/${f}`);
}

const written = [];
for (let i = 0; i < tweets.length; i++) {
  const t = tweets[i];
  const svg = tweetSvg(t, profile || {}, i);
  const path = `${ASSETS_DIR}/${t.id}.svg`;
  await writeFile(path, svg);
  written.push({ id: t.id, path });
}
console.log(`Wrote ${written.length} tweet SVG(s).`);

// README block: three <a><img></a> blocks stacked vertically, each linking
// to its tweet permalink so clicking opens the actual post.
const username = profile?.username || "yanukadeneth99";
const ts = Date.now(); // cache-buster for GitHub's camo image proxy
let readmeBlock;
if (written.length === 0) {
  readmeBlock = `<p><em>No recent posts.</em></p>`;
} else {
  const cards = written
    .map(
      ({ id }) =>
        // width="880" (not 100%) so the SVG renders at its native CSS-pixel
        // size — keeps text at the intended 15px regardless of how wide the
        // viewer's screen is. On narrower screens the parent <p> with overflow
        // handles itself; on wider screens we stay at the designed width
        // rather than upscaling.
        `  <a href="https://x.com/${username}/status/${id}"><img src="https://raw.githubusercontent.com/yanukadeneth99/yanukadeneth99/main/${ASSETS_DIR}/${id}.svg?v=${ts}" alt="X post ${id}" width="880" /></a>`,
    )
    .join("<br/><br/>\n");
  readmeBlock = `<p>\n${cards}\n</p>`;
}

const current = await readFile(README, "utf8");
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!pattern.test(current)) {
  throw new Error(`Markers ${START} / ${END} not found in README.md`);
}
const next = current.replace(pattern, `${START}\n${readmeBlock}\n${END}`);
if (next !== current) {
  await writeFile(README, next);
  console.log("README updated.");
}
