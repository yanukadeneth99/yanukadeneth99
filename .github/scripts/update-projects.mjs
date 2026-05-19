// Generates one SVG per project ("brick") + the README block that lays them
// out as clickable cells. Visual model = vertical bricks with bottom-up fill:
//
//   shipped   = 100% filled (project is done)
//   active    =  25% filled (work has started; literal "quarter")
//   upcoming  =   0% filled (outline only)
//
// Each brick is written to .github/assets/bricks/<slug>.svg and embedded in
// README via <a href><img></a>. The reason we write per-brick instead of one
// big SVG is so each cell can be its own clickable link — GitHub strips
// <a xlink:href> inside an <img> SVG, so the only way to make bricks
// independently clickable is one image per brick wrapped in HTML <a>.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Buffer } from "node:buffer";

const DATA = ".github/data/shipped.json";
const COUNTS = ".github/data/counts.json";
const README = "README.md";
const ASSETS_DIR = ".github/assets/bricks";
const START = "<!-- PROJECTS:START -->";
const END = "<!-- PROJECTS:END -->";

// Brick geometry — vertical rectangles, taller than wide, like Lego bricks.
const W = 130;
const H = 160;
const R = 14; // border radius

// Status → colour palette + fill percentage. GitHub status conventions for
// instant intuition: green=done, amber=in-progress, slate=not-started.
const STATUS = {
  shipped: { color: "#3FB950", fillPct: 100, label: "Shipped" },
  active: { color: "#D29922", fillPct: 25, label: "Active" },
  upcoming: { color: "#8B949E", fillPct: 0, label: "Upcoming" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(s) {
  // URL-safe filename. Falls back to "x" if name was all punctuation.
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}

function xml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Initial letter for monogram fallback. Strips punctuation/emojis so brand
// names like ".Foo" or "🚀 Bar" still pick a real letter.
function initial(name) {
  const m = String(name).match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : "•";
}

async function fetchAsDataUri(url) {
  // Best-effort fetch — if it fails (network, 404, CORS-y), we return null
  // and the caller falls back to the monogram. We never block the build on
  // a missing logo.
  try {
    const r = await fetch(url, { headers: { "User-Agent": "yanukadeneth99-brick-bot" } });
    if (!r.ok) return null;
    const mime = r.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// ─── Brick SVG ──────────────────────────────────────────────────────────────

function brickSvg(project, logoDataUri) {
  const status = STATUS[project.status] || STATUS.upcoming;
  const { color, fillPct, label } = status;

  // Fill rect grows from the bottom. We clip it to the rounded-rect shape so
  // the fill respects the corner radius (otherwise it would peek past corners).
  const innerInset = 1.5; // matches stroke width so fill sits inside border
  const fillHeight = (H - innerInset * 2) * (fillPct / 100);
  const fillY = H - innerInset - fillHeight;

  // Logo area: a 48x48 square at the top, centered horizontally.
  const logoSize = 48;
  const logoX = (W - logoSize) / 2;
  const logoY = 18;

  // Logo block: either base64 image OR a colored circle with the initial.
  const logoBlock = logoDataUri
    ? `<image href="${logoDataUri}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`
    : `<circle cx="${W / 2}" cy="${logoY + logoSize / 2}" r="${logoSize / 2}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.5"/>
       <text x="${W / 2}" y="${logoY + logoSize / 2 + 8}" font-size="22" font-weight="700" text-anchor="middle" fill="#E6EDF3" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">${xml(initial(project.name))}</text>`;

  // Name: centered, allow up to 2 lines via simple word-wrap (~12 chars/line at this width).
  const nameLines = wrapName(project.name);
  const nameStartY = 86;
  const nameLineHeight = 16;
  const nameSvg = nameLines
    .map(
      (ln, i) =>
        `<tspan x="${W / 2}" dy="${i === 0 ? 0 : nameLineHeight}" text-anchor="middle">${xml(ln)}</tspan>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${xml(project.name)} (${xml(label)})">
  <!-- Clip path for the fill so it respects the brick's rounded corners. -->
  <defs>
    <clipPath id="clip-${slugify(project.name)}">
      <rect x="${innerInset}" y="${innerInset}" width="${W - innerInset * 2}" height="${H - innerInset * 2}" rx="${R - innerInset}" ry="${R - innerInset}"/>
    </clipPath>
  </defs>

  <!-- Background fill rises from the bottom by fillPct of inner height. -->
  <g clip-path="url(#clip-${slugify(project.name)})">
    <rect x="${innerInset}" y="${fillY}" width="${W - innerInset * 2}" height="${fillHeight}" fill="${color}" fill-opacity="0.22"/>
  </g>

  <!-- Brick outline. Stroke is solid in status colour; no fill so the
       interior fill shows through. -->
  <rect x="${innerInset}" y="${innerInset}" width="${W - innerInset * 2}" height="${H - innerInset * 2}" rx="${R - innerInset}" ry="${R - innerInset}" fill="none" stroke="${color}" stroke-width="1.5"/>

  ${logoBlock}

  <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#E6EDF3" y="${nameStartY}">
    ${nameSvg}
  </text>

  <!-- Tiny status label at bottom, dimmed. -->
  <text x="${W / 2}" y="${H - 14}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="10" font-weight="500" fill="${color}" text-anchor="middle" letter-spacing="1">${xml(label.toUpperCase())}</text>
</svg>`;
}

// Wrap a project name to fit the brick width (~12 chars/line at 13px font).
function wrapName(name, maxChars = 13) {
  const words = String(name).split(/\s+/);
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
  if (lines.length > 2) {
    lines.length = 2;
    lines[1] = lines[1].slice(0, maxChars - 1) + "…";
  }
  return lines;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const data = JSON.parse(await readFile(DATA, "utf8"));
const projects = Array.isArray(data.projects) ? data.projects : [];

// Write per-status counts to a flat file so shields.io can read them with a
// simple JSONPath. shields.io's filter expressions are unreliable, and writing
// derived data here keeps the schema in shipped.json clean (no _counts field).
// counts.json is intentionally NOT in update-projects.yml's `paths:` trigger
// list — otherwise we'd loop (write counts → push → trigger → write counts).
const counts = {
  shipped: projects.filter((p) => p.status === "shipped").length,
  active: projects.filter((p) => p.status === "active").length,
  upcoming: projects.filter((p) => p.status === "upcoming").length,
};
await mkdir(".github/data", { recursive: true });
await writeFile(COUNTS, JSON.stringify(counts, null, 2) + "\n");

await mkdir(ASSETS_DIR, { recursive: true });

// Render each brick in parallel — logo fetches are independent.
const rendered = await Promise.all(
  projects.map(async (p) => {
    const logoUri = p.logo ? await fetchAsDataUri(p.logo) : null;
    const svg = brickSvg(p, logoUri);
    const slug = slugify(p.name);
    const path = `${ASSETS_DIR}/${slug}.svg`;
    await writeFile(path, svg);
    return { project: p, slug, path };
  }),
);

// README block: centered <p> with each brick as a clickable image. Putting
// them in one <p> lets them flow and wrap naturally on narrow viewports —
// no rigid table grid that would force a horizontal scrollbar on mobile.
const bricks = rendered
  .map(({ project, slug }) => {
    const url = project.url || "#";
    // Cache-bust the SVG URL so GitHub's camo proxy fetches the new one
    // whenever shipped.json changes (camo caches images for hours otherwise).
    const src = `https://raw.githubusercontent.com/yanukadeneth99/yanukadeneth99/main/${ASSETS_DIR}/${slug}.svg?v=${Date.now()}`;
    return `  <a href="${xml(url)}" title="${xml(project.name)}"><img src="${src}" alt="${xml(project.name)}" width="${W}" height="${H}" /></a>`;
  })
  .join("\n");

const block =
  projects.length === 0
    ? `<p align="center"><em>No projects yet.</em></p>`
    : `<p align="center">\n${bricks}\n</p>`;

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
  console.log("README unchanged (bricks may have changed).");
}
console.log(`Rendered ${rendered.length} brick(s).`);
