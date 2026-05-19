<div align="center">

<!-- Compact header capsule: height 130 (was 200), title-only, no subtitle.
     Saves ~70vh of vertical space so the live widgets are visible above the
     fold for most laptop viewports. -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,24&height=130&section=header&text=YASHURA&fontSize=64&fontColor=ffffff&fontAlignY=42&animation=fadeIn" width="100%" alt="Header" />

<!-- Single row of badges. Left group = CTAs (visitors/portfolio/ko-fi),
     right group = project status counts (shipped/active/upcoming). The
     non-breaking-space pipe acts as a visual divider — GitHub strips CSS
     so we use a literal character rather than a styled border. Project
     counts read from counts.json (written by update-projects script). -->
<p align="center">
  <img src="https://komarev.com/ghpvc/?username=yanukadeneth99&style=for-the-badge&color=2f81f7&label=VISITORS" alt="Visitors" />
  <a href="https://yanukadeneth.com"><img src="https://img.shields.io/badge/Portfolio-2f81f7?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Portfolio" /></a>
  <a href="https://ko-fi.com/yanukadeneth99"><img src="https://img.shields.io/badge/Support_on_Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Ko-fi" /></a>
  &nbsp;<img src="https://img.shields.io/badge/%20-%7C%20-0d1117?style=for-the-badge" alt="|" />&nbsp;
  <a href="https://github.com/yanukadeneth99/yanukadeneth99/blob/main/.github/data/shipped.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fyanukadeneth99%2Fyanukadeneth99%2Fmain%2F.github%2Fdata%2Fcounts.json&query=%24.shipped&label=Shipped&color=3FB950&style=for-the-badge&logo=check&logoColor=white" alt="Shipped" /></a>
  <a href="https://github.com/yanukadeneth99/yanukadeneth99/blob/main/.github/data/shipped.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fyanukadeneth99%2Fyanukadeneth99%2Fmain%2F.github%2Fdata%2Fcounts.json&query=%24.active&label=Active&color=D29922&style=for-the-badge&logo=hammer&logoColor=white" alt="Active" /></a>
  <a href="https://github.com/yanukadeneth99/yanukadeneth99/blob/main/.github/data/shipped.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fyanukadeneth99%2Fyanukadeneth99%2Fmain%2F.github%2Fdata%2Fcounts.json&query=%24.upcoming&label=Upcoming&color=8B949E&style=for-the-badge&logo=hourglass&logoColor=white" alt="Upcoming" /></a>
</p>

</div>

---

<!-- LIVE: Currently building. Auto-updated every 6h by
     .github/workflows/update-building.yml. Edit the markers, not the content. -->

### 🛠 Currently Building

<!-- BUILDING:START -->
> 🌱 _Quiet on the public side right now — probably deep in a private repo._
<!-- BUILDING:END -->

---

<!-- LIVE: Projects list. Rendered from .github/data/shipped.json by
     .github/workflows/update-projects.yml — edit the JSON, not the README. -->

### 🚀 Projects

<!-- PROJECTS:START -->
<p align="center">
  <a href="https://cueclock.app" title="Cue Clock"><img src="https://raw.githubusercontent.com/yanukadeneth99/yanukadeneth99/main/.github/assets/bricks/cue-clock.svg?v=1779185090544" alt="Cue Clock" width="130" height="160" /></a>
  <a href="https://streammonitor.app" title="Stream Monitor"><img src="https://raw.githubusercontent.com/yanukadeneth99/yanukadeneth99/main/.github/assets/bricks/stream-monitor.svg?v=1779185090544" alt="Stream Monitor" width="130" height="160" /></a>
  <a href="#" title="AI Workflow 1"><img src="https://raw.githubusercontent.com/yanukadeneth99/yanukadeneth99/main/.github/assets/bricks/ai-workflow-1.svg?v=1779185090544" alt="AI Workflow 1" width="130" height="160" /></a>
</p>
<!-- PROJECTS:END -->

---

<!-- LIVE: Discord presence + Spotify now-playing, side by side.
     A markdown table forces them onto one row regardless of viewport width.
     Replace YOUR_DISCORD_ID and YOUR_SPOTIFY_UID — see setup notes below. -->

<!-- Centered H3: markdown headings default to left-aligned because they live
     in document flow, not in a centered container. Inline <h3 align="center">
     overrides that for just this heading without affecting siblings. -->
<h3 align="center">🎧 Right Now</h3>

<!-- width="100%" on the table forces it to span the full content area; the
     same attribute on each <img> makes the SVG widgets stretch to fill their
     cells while keeping aspect ratio (both are viewBox-based, so they scale
     cleanly). This eliminates the wasted side gutters. -->
<table width="100%">
  <tr>
    <td align="center" width="50%">
      <a href="https://discord.com/users/660852074644373505">
        <img width="100%" src="https://lanyard.cnrad.dev/api/660852074644373505?bg=0d1117&theme=dark&borderRadius=12px&fallbackStatusText=Chilling..&hideDiscrim=true" alt="Discord Presence" />
      </a>
    </td>
    <td align="center" width="50%">
      <a href="https://open.spotify.com/artist/4Yo79ck5nJ8Cplrf2DrKOG">
        <img width="100%" src="https://hhzluaxzb4smr2jmra.vercel.app/api/spotify" alt="Spotify Now Playing" />
      </a>
    </td>
  </tr>
</table>

---

<!-- LIVE: Top 3 X posts by engagement. Auto-updated weekly by
     .github/workflows/update-x-posts.yml. -->

### 🐦 Top Posts on X

<!-- XPOSTS:START -->
> @IGN Genuine question. How do you enjoy Forza? Not trying to rage bait or be stupid. I'm a person who loves story heavy games and was wondering why and how people enjoy this game enough to rate 10 and have global impact.  
> 
> [❤️ 7 · 🔁 0 · 💬 4](https://x.com/i/web/status/2056199834722558071)
>
> ---
>
> @Rainmaker1973 @grok is this factually true? In the video the lecturer explains that purple is caused in the mix of red and blue due to the absence of green and that purple photons do not exist.  
> 
> [❤️ 4 · 🔁 1 · 💬 5](https://x.com/i/web/status/2055873061065462139)
>
> ---
>
> @PersoEa @IGN I doubt that's true to be honest. Games are a form of an entertainment and so are movies. It's weird to say people who like one kind of entertainment don't like the other no? @grok based on general research, do people who play  
> 
> [❤️ 1 · 🔁 0 · 💬 2](https://x.com/i/web/status/2056233376223523223)
<!-- XPOSTS:END -->

<p align="center">
  <a href="https://x.com/yanukadeneth99">
    <img src="https://img.shields.io/badge/Follow-000000?style=for-the-badge&logo=x&logoColor=white" alt="Follow on X" />
  </a>
</p>

---

<div align="center">

### 📊 GitHub Stats

<p align="center">
  <a href="https://git.io/streak-stats">
    <img src="https://streak-stats.demolab.com?user=yanukadeneth99&theme=dark&background=0D1117&ring=2f81f7&fire=2f81f7&currStreakLabel=2f81f7&hide_border=true&date_format=M%20j%5B%2C%20Y%5D" alt="GitHub Streak" height="180" />
  </a>
  <img src="https://github-profile-summary-cards.vercel.app/api/cards/repos-per-language?username=yanukadeneth99&theme=github_dark&title_color=2f81f7" alt="Languages" height="180" />
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/yanukadeneth99/yanukadeneth99/output/pacman-contribution-graph-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/yanukadeneth99/yanukadeneth99/output/pacman-contribution-graph.svg">
  <img alt="Pac-Man contribution graph" src="https://raw.githubusercontent.com/yanukadeneth99/yanukadeneth99/output/pacman-contribution-graph.svg">
</picture>

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,24&height=80&section=footer" width="100%" alt="" />

</div>
