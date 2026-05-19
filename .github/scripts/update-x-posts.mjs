// Generates a single SVG of the top 3 X posts as modern X-style tweet cards
// (dark theme, real avatar, engagement icons), writes it to
// .github/assets/x-posts.svg, and points the README XPOSTS block at it.
//
// Why an SVG instead of markdown blockquotes?
//  - GitHub strips inline <svg> and most CSS — only <img src="...svg"> works.
//  - One image = zero broken-image flicker, identical rendering across themes,
//    and total pixel control (font weights, colours, icon paths).
//
// Cost model:
//  - Tweets endpoint: 50 posts × $0.001, hourly, dedup'd within 24h → ~$1.50/mo
//  - User endpoint (for avatar): cached 7 days → ~$0.004/mo
//
// Requires env: X_BEARER_TOKEN, X_USER_ID

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Buffer } from "node:buffer";

const BEARER = process.env.X_BEARER_TOKEN;
const USER_ID = process.env.X_USER_ID;
const README = "README.md";
const SVG_PATH = ".github/assets/x-posts.svg";
const CACHE_PATH = ".github/data/x-cache.json";
const START = "<!-- XPOSTS:START -->";
const END = "<!-- XPOSTS:END -->";

// 7-day cache for the avatar — refreshes occasionally without burning $0.001
// per workflow run on what's effectively static data.
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
    return cache; // fall back to stale cache rather than failing the whole run
  }
  const { data } = await res.json();

  // X returns a _normal (48x48) sized image by default; strip the suffix for
  // the original-resolution version which renders cleanly at 40px display.
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

// SVG <text> doesn't wrap; precompute breaks at ~78 chars (≈ 7.6px/char at 15px).
function wrapText(text, maxChars = 78) {
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
  // Cap at 4 lines so super-long tweets don't make giant cards.
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

const COLOR = {
  bg: "#000000",
  text: "#E7E9EA",
  muted: "#71767B",
  separator: "rgba(255,255,255,0.12)",
};

// Compact 18px icons — recognizable not pixel-perfect.
const ICONS = {
  reply: `<path d="M3 4.5C3 3.12 4.12 2 5.5 2h7C13.88 2 15 3.12 15 4.5v6c0 1.38-1.12 2.5-2.5 2.5H9.5L6 16v-3H5.5C4.12 13 3 11.88 3 10.5v-6z"/>`,
  retweet: `<path d="M5 4h7v2H6.5l1 1L6 8.5 3 6l3-2.5L7 4.5 5 4zm8 10H6v-2h7l-1-1 1.5-1.5L17 12l-3 2.5-1-1L13 14z"/>`,
  like: `<path d="M9 15.5l-.95-.86C4.4 11.36 2 9.28 2 6.5 2 4.42 3.42 3 5.5 3c1.16 0 2.28.54 3 1.39C9.22 3.54 10.34 3 11.5 3 13.58 3 15 4.42 15 6.5c0 2.78-2.4 4.86-6.05 8.14L9 15.5z"/>`,
};

const CARD = {
  width: 760,
  paddingX: 18,
  paddingTop: 16,
  paddingBottom: 16,
  avatarSize: 40,
  avatarGutter: 14,
  headerBaseline: 32,
  bodyLineHeight: 20,
  bodyTopGap: 22, // gap from header baseline to first body line top
  engagementTopGap: 16,
  engagementHeight: 18,
};

function renderCard(tweet, profile, idx, yOffset) {
  const lines = wrapText(tweet.text);
  const bodyHeight = lines.length * CARD.bodyLineHeight;

  const contentX = CARD.paddingX + CARD.avatarSize + CARD.avatarGutter;
  const headerY = CARD.paddingTop + CARD.headerBaseline - 12; // baseline-ish
  const bodyStartY = headerY + CARD.bodyTopGap;
  const engagementY = bodyStartY + (lines.length - 1) * CARD.bodyLineHeight + CARD.engagementTopGap;
  const cardHeight = engagementY + CARD.engagementHeight + CARD.paddingBottom;

  const handle = `@${profile.username || "yanukadeneth99"}`;
  const name = profile.name || "Yanuka";
  const time = relTime(tweet.created_at);

  const cx = CARD.paddingX + CARD.avatarSize / 2;
  const cy = CARD.paddingTop + CARD.avatarSize / 2;
  const avatarClipId = `ava-${idx}`;
  const avatar = profile.avatar
    ? `<clipPath id="${avatarClipId}"><circle cx="${cx}" cy="${cy}" r="${CARD.avatarSize / 2}"/></clipPath>
       <image href="${profile.avatar}" x="${CARD.paddingX}" y="${CARD.paddingTop}" width="${CARD.avatarSize}" height="${CARD.avatarSize}" clip-path="url(#${avatarClipId})" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${CARD.avatarSize / 2}" fill="#1d9bf0"/>
       <text x="${cx}" y="${cy + 6}" font-size="18" font-weight="700" text-anchor="middle" fill="#fff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Y</text>`;

  const header = `<text x="${contentX}" y="${headerY}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15">
      <tspan font-weight="700" fill="${COLOR.text}">${xml(name)}</tspan>
      <tspan fill="${COLOR.muted}">  ${xml(handle)} · ${xml(time)}</tspan>
    </text>`;

  const bodyTspans = lines
    .map(
      (ln, i) =>
        `<tspan x="${contentX}" dy="${i === 0 ? 0 : CARD.bodyLineHeight}">${xml(ln)}</tspan>`,
    )
    .join("");
  const body = `<text x="${contentX}" y="${bodyStartY}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" fill="${COLOR.text}">${bodyTspans}</text>`;

  // Engagement row: reply / retweet / like, 110px stride between groups.
  const eg = [
    { icon: ICONS.reply, count: fmtCount(tweet.replies) },
    { icon: ICONS.retweet, count: fmtCount(tweet.retweets) },
    { icon: ICONS.like, count: fmtCount(tweet.likes) },
  ]
    .map(({ icon, count }, i) => {
      const gx = contentX + i * 110;
      return `<g transform="translate(${gx}, ${engagementY})" fill="${COLOR.muted}">
        ${icon}
        <text x="26" y="13" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" fill="${COLOR.muted}">${xml(count)}</text>
      </g>`;
    })
    .join("");

  const separator = `<line x1="0" y1="${cardHeight}" x2="${CARD.width}" y2="${cardHeight}" stroke="${COLOR.separator}" stroke-width="1"/>`;

  return {
    height: cardHeight,
    svg: `<g transform="translate(0, ${yOffset})">
      ${avatar}
      ${header}
      ${body}
      ${eg}
      ${separator}
    </g>`,
  };
}

function renderSvg(tweets, profile) {
  let y = 0;
  const parts = tweets.map((t, i) => {
    const c = renderCard(t, profile, i, y);
    y += c.height;
    return c.svg;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${y}" viewBox="0 0 ${CARD.width} ${y}" role="img" aria-label="Top X Posts">
  <rect width="${CARD.width}" height="${y}" fill="${COLOR.bg}"/>
  ${parts.join("\n")}
</svg>`;
}

function renderEmptySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="100" viewBox="0 0 ${CARD.width} 100" role="img" aria-label="Top X Posts">
  <rect width="${CARD.width}" height="100" fill="${COLOR.bg}"/>
  <text x="${CARD.width / 2}" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="${COLOR.muted}" text-anchor="middle">No recent posts.</text>
</svg>`;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const [profile, tweets] = await Promise.all([getProfile(), getTopTweets()]);
const svg = tweets.length > 0 ? renderSvg(tweets, profile || {}) : renderEmptySvg();

await mkdir(".github/assets", { recursive: true });
await writeFile(SVG_PATH, svg);
console.log(`Wrote ${SVG_PATH} (${svg.length} bytes, ${tweets.length} tweets).`);

// Cache-bust the SVG URL so GitHub's camo image proxy fetches the fresh
// version instead of serving the cached one (camo caches hours).
const readmeBlock = `<p align="center">
  <a href="https://x.com/${profile?.username || "yanukadeneth99"}"><img src="https://raw.githubusercontent.com/yanukadeneth99/yanukadeneth99/main/.github/assets/x-posts.svg?v=${Date.now()}" alt="Top X Posts" width="760" /></a>
</p>`;

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
