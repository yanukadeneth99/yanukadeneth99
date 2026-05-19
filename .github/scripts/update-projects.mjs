// Renders the "Projects" section of README.md from .github/data/shipped.json.
// We keep the JSON as the single source of truth so the badge (shields.io
// dynamic JSON, counting array length) and the README list never drift out
// of sync — both read from the same file.
//
// README contract: two marker pairs that this script rewrites in place.
//   <!-- PROJECTS:START --> ... <!-- PROJECTS:END -->

import { readFile, writeFile } from "node:fs/promises";

const DATA = ".github/data/shipped.json";
const README = "README.md";
const START = "<!-- PROJECTS:START -->";
const END = "<!-- PROJECTS:END -->";

const data = JSON.parse(await readFile(DATA, "utf8"));
const shipped = Array.isArray(data.shipped) ? data.shipped : [];
const upcoming = Array.isArray(data.upcoming) ? data.upcoming : [];

// Helper: render a single project entry as a list bullet. We keep formatting
// simple (no tables) so GitHub mobile renders cleanly.
const renderShipped = (p) => {
  const title = p.url ? `[**${p.name}**](${p.url})` : `**${p.name}**`;
  const date = p.date ? ` · \`${p.date}\`` : "";
  const note = p.note ? ` — ${p.note}` : "";
  return `- ✅ ${title}${date}${note}`;
};
const renderUpcoming = (p) => {
  const title = p.url ? `[**${p.name}**](${p.url})` : `**${p.name}**`;
  const note = p.note ? ` — ${p.note}` : "";
  return `- 🔜 ${title}${note}`;
};

const sections = [];
if (shipped.length) {
  sections.push(`**Shipped in ${data.year}**\n\n${shipped.map(renderShipped).join("\n")}`);
}
if (upcoming.length) {
  sections.push(`**Upcoming**\n\n${upcoming.map(renderUpcoming).join("\n")}`);
}
const block = sections.length ? sections.join("\n\n") : `_Nothing logged yet._`;

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
