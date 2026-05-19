// Generates two self-hosted stat SVGs and writes them to .github/assets/:
//   languages.svg     — donut chart of top languages across all your repos
//   contributions.svg — bar chart of contributions aggregated PER MONTH
//
// Why self-hosted? github-readme-stats has been intermittently paused on
// Vercel (HTTP 503 DEPLOYMENT_PAUSED), and github-readme-activity-graph
// only plots one point per day with no aggregation option. Owning both
// charts in this repo means they'll never go down, render exactly to our
// brand palette, and stay in sync with the rest of the profile workflows.
//
// Data sources (both authenticated with GITHUB_TOKEN):
//   - Languages: REST /repos + /languages per repo
//   - Contributions: GraphQL contributionsCollection (12-month window)

import { writeFile, mkdir } from "node:fs/promises";

const USER = process.env.GH_USER || "yanukadeneth99";
const TOKEN = process.env.GITHUB_TOKEN;

const ACCENT = "#A371F7";
const BG = "#0D1117";
const TEXT = "#E6EDF3";
const MUTED = "#7D8590";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "yanukadeneth99-stats-bot",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

// Subset of github-linguist's official colour map for languages I'm likely
// to use. Unknown languages fall back to the brand purple so the chart
// never has a literally-empty slice.
const LANG_COLORS = {
  JavaScript: "#F1E05A",
  TypeScript: "#3178C6",
  Python: "#3572A5",
  Java: "#B07219",
  "C++": "#F34B7D",
  "C#": "#178600",
  C: "#555555",
  Go: "#00ADD8",
  Ruby: "#701516",
  Rust: "#DEA584",
  PHP: "#4F5D95",
  Shell: "#89E051",
  HTML: "#E34C26",
  CSS: "#563D7C",
  SCSS: "#C6538C",
  Vue: "#41B883",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Solidity: "#AA6746",
  Lua: "#000080",
  "Jupyter Notebook": "#DA5B0B",
  "Objective-C": "#438EFF",
  Scala: "#C22D40",
  Haskell: "#5E5086",
  Elixir: "#6E4A7E",
  R: "#198CE7",
  Perl: "#0298C3",
  Clojure: "#DB5855",
  Dockerfile: "#384D54",
  PowerShell: "#012456",
  GLSL: "#5686A5",
  HLSL: "#AACE60",
  Makefile: "#427819",
  Nix: "#7E7EFF",
  TeX: "#3D6117",
  Svelte: "#FF3E00",
  Astro: "#FF5A03",
  Zig: "#EC915C",
};

function xml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Languages ──────────────────────────────────────────────────────────────

async function getLanguages() {
  // Pull up to 100 public repos owned by the user. Skip forks and archived
  // so the chart reflects code we actually wrote and maintain.
  const repos = await fetch(
    `https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=pushed`,
    { headers },
  ).then((r) => r.json());

  if (!Array.isArray(repos)) {
    console.warn("Repos response not array:", repos);
    return {};
  }

  const totals = {};
  // Parallel fetch of /languages per repo — 100ms each, ~30 repos = 3s
  // serially, ~300ms in parallel. GitHub allows 5000 req/hour authenticated.
  await Promise.all(
    repos
      .filter((r) => !r.fork && !r.archived)
      .map(async (repo) => {
        try {
          const data = await fetch(repo.languages_url, { headers }).then((r) => r.json());
          for (const [lang, bytes] of Object.entries(data || {})) {
            totals[lang] = (totals[lang] || 0) + bytes;
          }
        } catch (e) {
          console.warn(`Failed languages for ${repo.name}: ${e.message}`);
        }
      }),
  );
  return totals;
}

function languagesDonutSvg(langs, topN = 8) {
  const sorted = Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
  const total = sorted.reduce((s, [, b]) => s + b, 0) || 1;

  // Card geometry: donut on the left, legend right. 480x240 fits nicely
  // alongside the contribution bar chart and stays readable on mobile.
  const W = 480;
  const H = 240;
  const cx = 110;
  const cy = H / 2 + 10;
  const r = 75;
  const innerR = 45;

  let angle = -Math.PI / 2; // start at 12 o'clock
  const arcs = sorted.map(([lang, bytes]) => {
    const pct = bytes / total;
    const sweep = pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const x3 = cx + innerR * Math.cos(angle + sweep);
    const y3 = cy + innerR * Math.sin(angle + sweep);
    const x4 = cx + innerR * Math.cos(angle);
    const y4 = cy + innerR * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const color = LANG_COLORS[lang] || ACCENT;
    angle += sweep;
    return {
      path: `M ${x1},${y1} A ${r},${r} 0 ${large} 1 ${x2},${y2} L ${x3},${y3} A ${innerR},${innerR} 0 ${large} 0 ${x4},${y4} Z`,
      color,
      lang,
      pct,
    };
  });

  // Legend: color swatch + lang name on the left, percentage right-aligned.
  const legend = arcs
    .map((a, i) => {
      const ly = 56 + i * 20;
      return `
      <rect x="220" y="${ly - 10}" width="12" height="12" rx="3" fill="${a.color}"/>
      <text x="240" y="${ly}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="${TEXT}">${xml(a.lang)}</text>
      <text x="${W - 20}" y="${ly}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="${MUTED}" text-anchor="end">${(a.pct * 100).toFixed(1)}%</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Top Languages">
  <rect width="${W}" height="${H}" fill="${BG}" rx="12"/>
  <text x="20" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="${ACCENT}">Top Languages</text>
  ${arcs.map((a) => `<path d="${a.path}" fill="${a.color}"/>`).join("\n  ")}
  ${legend}
</svg>`;
}

// ─── Contributions (monthly) ────────────────────────────────────────────────

async function getMonthlyContributions() {
  // GraphQL's contributionsCollection returns the last 12 months of daily
  // counts. We aggregate to month buckets locally — fewer round trips than
  // calling 12 separate queries with date ranges.
  const query = `query {
    user(login: "${USER}") {
      contributionsCollection {
        contributionCalendar {
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }`;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));

  const days = (data.data?.user?.contributionsCollection?.contributionCalendar?.weeks || []).flatMap(
    (w) => w.contributionDays,
  );

  const monthly = {};
  for (const d of days) {
    const key = d.date.slice(0, 7); // "YYYY-MM"
    monthly[key] = (monthly[key] || 0) + d.contributionCount;
  }
  return Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b));
}

function contributionsBarSvg(monthly) {
  const W = 880;
  const H = 260;
  const pad = { top: 55, right: 24, bottom: 50, left: 24 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const counts = monthly.map(([, c]) => c);
  const maxCount = Math.max(...counts, 1);
  const slotW = chartW / Math.max(monthly.length, 1);
  const barW = Math.max(slotW - 8, 4);

  const bars = monthly
    .map(([month, count], i) => {
      const x = pad.left + i * slotW + (slotW - barW) / 2;
      const h = (count / maxCount) * chartH;
      const y = pad.top + chartH - h;
      const monthLabel = new Date(month + "-01T00:00:00Z").toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      });

      return `
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="6" fill="${ACCENT}" fill-opacity="0.85"/>
      <text x="${(x + barW / 2).toFixed(2)}" y="${(y - 6).toFixed(2)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="${TEXT}" text-anchor="middle">${count}</text>
      <text x="${(x + barW / 2).toFixed(2)}" y="${H - pad.bottom + 22}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="${MUTED}" text-anchor="middle">${xml(monthLabel)}</text>`;
    })
    .join("");

  // Subtle baseline so the bars look anchored, not floating.
  const baselineY = pad.top + chartH + 0.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly Contributions">
  <rect width="${W}" height="${H}" fill="${BG}" rx="12"/>
  <text x="20" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="${ACCENT}">Contributions per Month</text>
  <text x="${W - 20}" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="${MUTED}" text-anchor="end">last 12 months</text>
  <line x1="${pad.left}" y1="${baselineY}" x2="${W - pad.right}" y2="${baselineY}" stroke="${MUTED}" stroke-opacity="0.25" stroke-width="1"/>
  ${bars}
</svg>`;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const [langs, monthly] = await Promise.all([getLanguages(), getMonthlyContributions()]);

await mkdir(".github/assets", { recursive: true });
await writeFile(".github/assets/languages.svg", languagesDonutSvg(langs));
await writeFile(".github/assets/contributions.svg", contributionsBarSvg(monthly));

console.log(
  `Wrote languages.svg (${Object.keys(langs).length} langs) and contributions.svg (${monthly.length} months).`,
);
