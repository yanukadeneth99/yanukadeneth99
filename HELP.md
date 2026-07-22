# HELP — Fork & Setup Guide

This profile README is a small system of self-hosted SVG generators plus two
live widgets that pull data from external services. Forking it and getting
everything green takes about 15–20 minutes of focused setup.

This guide is written step-by-step. Skip any section whose feature you don't
want.

---

## What's in this repo

| Path | Purpose |
|---|---|
| `README.md` | The profile content. |
| `.github/assets/languages.svg` | Auto-generated. Donut of language usage. |
| `.github/assets/contributions.svg` | Auto-generated. Monthly contribution bar chart. |
| `.github/scripts/update-stats.mjs` | Renders languages donut + monthly contributions chart. |
| `.github/workflows/update-stats.yml` | Daily 06:00 UTC. |

There are two things that come from external services:
- **Visitor counter** (komarev.com) — no setup needed
- **Discord presence** (Lanyard) — see section 3

---

## Section 1 — Fork & rename

1. **Fork this repository** on GitHub.
2. **Rename it to match your username.** GitHub uses the special `username/username` repo as your profile README. So if your username is `octocat`, your fork must be at `github.com/octocat/octocat`.
3. **Clone your fork locally:**
   ```bash
   git clone git@github.com:<your-username>/<your-username>.git
   cd <your-username>
   ```

---

## Section 2 — Personalize the README

Open `README.md` and do a find-and-replace of the original owner's username with yours. There are several occurrences (badge URLs, raw asset URLs, profile links). On macOS/Linux:

```bash
# Replace <OWNER> with the original owner's username (the one this was forked from)
# Replace <YOU> with yours.
sed -i '' "s/<OWNER>/<YOU>/g" README.md
```

Or do it in your editor. The same swap is needed in:
- `.github/scripts/update-stats.mjs` — the `raw.githubusercontent.com/...` URLs

Other things in `README.md` to update:
- The hero text (`text=YOUR_BRAND`) in the `capsule-render.vercel.app` URL
- The typing tagline `lines=` query — change to your own lines (URL-encode them)
- The portfolio link (`href="https://your-portfolio.com"`)
- The Ko-fi link (`href="https://ko-fi.com/<your-handle>"`)

### Change the brand accent color

The accent purple is `#A371F7`. To switch to your own brand colour, find-and-replace `A371F7` across:
- `README.md`
- `.github/scripts/update-stats.mjs` (the `ACCENT` constant)

---

## Section 3 — Discord presence (optional)

The Discord widget uses **Lanyard** (`api.lanyard.rest`), a free open-source bot that exposes your Discord presence as a JSON API. The widget itself is rendered by `lanyard.cnrad.dev` from that data.

### Steps

1. **Join Lanyard's Discord server.** Lanyard can only read your presence if you share a server with its bot. Use the canonical invite: `https://discord.com/invite/lanyard`. (If `discord.gg/lanyard` is flaky, this longer URL works.)
2. **Enable Developer Mode in Discord.** Settings → Advanced → toggle Developer Mode on.
3. **Copy your numeric Discord user ID.** Right-click your name anywhere in Discord → "Copy User ID". It's a 17–19 digit number.
4. **Replace the placeholder in `README.md`.** Find both occurrences of the existing Discord ID (it appears in the `href` and the `src` of the Lanyard image) and replace with your own.

### Customizing

The `fallbackStatusText=Chilling..` query param in the Lanyard URL is what the widget shows when you're offline. Change to whatever you want. The `width` attribute on the `<img>` controls how large the chip renders.

---

## Section 4 — GitHub repo secrets

No custom secrets are required. `GITHUB_TOKEN` is auto-provided by Actions — never manually add it. It's used by the stats script for committing regenerated SVGs back to the repo.

Make sure Actions has write access: `Settings → Actions → General → Workflow permissions → Read and write permissions`.

---

## Section 5 — First-run

1. **Commit and push** all your changes (README replacements, etc.).
2. **Trigger workflows manually** so the assets get generated immediately rather than waiting for the daily schedule. Repo → Actions tab → pick each workflow → **Run workflow**:
   - **Update Stats SVGs** (renders languages.svg + contributions.svg)
3. Visit `https://github.com/<your-username>` and verify everything renders.

---

## Section 6 — Day-to-day

### Updating the typing tagline

Edit the `readme-typing-svg.demolab.com` URL in `README.md`. The `lines=` query param is `;`-separated, URL-encoded.

### When something looks stale

GitHub uses a CDN image proxy called **camo** that caches profile-README images aggressively. The two ways to bust it:
- **Wait** — eventually expires (sometimes hours)
- **Change the URL** — append a query param like `?cb=N` and bump `N`. The scripts already bump cache-busters automatically on regenerated assets.

### When a workflow fails

- Open the workflow run → see which step failed
- Re-run the workflow (Actions tab → workflow → ⋯ → "Re-run failed jobs")
- If it's persistent, check repo permissions: `Settings → Actions → General → Workflow permissions → Read and write permissions`

---

## Notes

### Note 1 — Cache-busters

You may see `?cb=1`, `?cb=2`, etc. on URLs in `README.md`. These are **manual cache-busters** for GitHub's image proxy. When you change something that should produce a visibly different image but the URL stays the same, bump the number. The auto-generated scripts use `?v=<timestamp>` for the same purpose on assets they produce.

### Note 2 — Why self-hosted SVGs

Many popular profile README tools (`github-readme-stats`, `github-profile-summary-cards`) run on Vercel's free tier, which sometimes goes down or returns `DEPLOYMENT_PAUSED` (HTTP 503). The self-hosted `update-stats.mjs` script generates equivalent SVGs as committed files in your own repo. Result: nothing breaks when a third-party service goes down.

### Note 3 — Costs

| Service | Cost | Notes |
|---|---|---|
| GitHub Actions | Free | 2000 minutes/month for public repos |
| Discord / Lanyard | Free | |
| Shields.io / Komarev / Capsule-Render | Free | |
| **TOTAL** | **Free** | |

### Note 4 — Workflows that auto-commit

`update-stats.yml` pushes commits back to your `main` branch. If you see "chore: refresh stats SVGs" commits in your history, that's normal — those are the automation runs.

### Note 5 — Excluding "noise" languages

The languages donut excludes Jupyter Notebook, HTML, CSS, Markdown, MDX, TeX, Roff, Text, and reStructuredText by default — these have byte counts that inflate massively due to embedded outputs or template scaffolding, and they don't represent authorship. To re-include or exclude others, edit the `EXCLUDE_LANGS` set at the top of `.github/scripts/update-stats.mjs`.

---

## Troubleshooting

### Discord widget 404s

- Did you actually join `discord.com/invite/lanyard`? Lanyard's bot needs to share a server with you.
- Is your Discord user ID the **numeric** one (17–19 digits)? Not your username.

### Top languages donut is empty or wrong

- Trigger **Update Stats SVGs** manually. The chart only regenerates daily otherwise.
- If most of your code is in private repos, the donut will look sparse — the GitHub API only returns public repo language stats with a default `GITHUB_TOKEN`. You'd need a PAT with `repo` scope to include private. (Adding a PAT is out of scope for this guide.)

---

## Stripping it down

Each feature is independent. You can safely delete:

- The Discord chip (the left cell of the two-column row under "GitHub Stats")
- The GitHub Stats section (or just one of the two charts)
