// Updates the "Currently Building" block in README.md with the most recent
// public PushEvent across all of the user's repos. We use the public Events
// feed because it is the cheapest way to get "latest commit anywhere" without
// having to enumerate every repo (rate-limit friendly: 1 request total).
//
// The README contains a marked region:
//   <!-- BUILDING:START -->
//   ...generated...
//   <!-- BUILDING:END -->
// We rewrite only what's between those markers so manual edits elsewhere are safe.

import { readFile, writeFile } from "node:fs/promises";

const USER = process.env.GH_USER || "yanukadeneth99";
const TOKEN = process.env.GITHUB_TOKEN; // auto-injected by Actions; raises rate limit from 60/hr to 5000/hr
const README = "README.md";
const START = "<!-- BUILDING:START -->";
const END = "<!-- BUILDING:END -->";

const headers = {
  "User-Agent": "yanukadeneth99-profile-bot",
  Accept: "application/vnd.github+json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

const res = await fetch(`https://api.github.com/users/${USER}/events/public?per_page=30`, { headers });
if (!res.ok) {
  // Fail loudly in CI rather than silently committing an empty block
  throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
}
const events = await res.json();

// Find the most recent PushEvent with at least one commit. PushEvents to forks
// are filtered out because they usually represent upstream syncs, not "building".
const push = events.find(
  (e) => e.type === "PushEvent" && e.payload?.commits?.length && !e.repo?.name?.includes("/fork-"),
);

let block;
if (!push) {
  block = `> 🌱 _Quiet on the public side right now — probably deep in a private repo._`;
} else {
  const commit = push.payload.commits[push.payload.commits.length - 1]; // newest commit in the push
  const repo = push.repo.name; // "owner/repo"
  const sha = commit.sha.slice(0, 7);
  const msg = commit.message.split("\n")[0].slice(0, 120); // first line, capped
  const when = new Date(push.created_at).toUTCString().replace(":00 GMT", " UTC");
  block = `> 🛠 **Currently:** [\`${repo}\`](https://github.com/${repo}) — _${msg}_  \n> [\`${sha}\`](https://github.com/${repo}/commit/${commit.sha}) · ${when}`;
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
