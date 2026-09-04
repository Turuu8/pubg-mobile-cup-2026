# DDAM CUP — PUBG Mobile Tournament Scoreboard

A single-file, offline-capable scoreboard for a 6-team / 3-match internal PUBG Mobile tournament.
Dark esports theme over a battleground backdrop, PMGC scoring, player-level stats, and a one-click
image export for sharing in company group chats.

Everything lives in **`index.html`** — no build step, no server, no dependencies to install.

---

## Quick start

Double-click `index.html`, or open it in a browser.

Chrome and Edge keep your results in `localStorage` even from `file://`. **Safari does not** — it
blocks storage on local files, so results would survive clicks but not a page refresh. If you use
Safari (or want to open the board on your phone over Wi-Fi), serve the folder instead:

```bash
python3 -m http.server 8000 --directory "/Users/ddam-m0080/Documents/Claude Code/ddam-cup-pubg-mobile"
```

Then open <http://localhost:8000>.

An internet connection is needed on first load for the CDN assets (Tailwind, html2canvas, Google
Fonts) and the Unsplash background photo. Once cached, the page works offline — and if the photo
never loads, the layout falls back cleanly to the flat `#0f172a` background.

---

## Tournament format

| | |
|---|---|
| Teams | 6 |
| Squad size | 4 players |
| Matches | 3 |
| Match 1 | Sanhok |
| Match 2 | Livik |
| Match 3 | Erangel |

### Point system (PMGC standard)

| Placement | Points |
|---|---|
| 1st (WWCD) | 10 |
| 2nd | 6 |
| 3rd | 5 |
| 4th | 4 |
| 5th | 2 |
| 6th | 1 |

Plus **1 point per kill**. A team's kills for a match are summed automatically from its 4 players —
you never type a team total.

### Tie-breakers

**Teams**, in order: Total Points → Total Kills → WWCD (chicken dinners) → best single placement →
team name.

**Players**, in order: Total Kills → Total Damage → player name.

---

## The two views

Switch between them with the **Leaderboard / Admin** toggle in the header.

### Admin — for the organizer

1. Pick the match (Match 1 / 2 / 3). Saved matches are marked `✓ saved`.
2. For each of the 6 teams: choose its **Rank Position**, then enter each player's **Name**,
   **Kills**, and **Damage**.
3. Team kills and match points update live in each card footer as you type.
4. Press **✓ Add / Update Match Result**.

Guards before a save goes through:

- every team must have a rank position;
- ranks #1–#6 must each be used exactly once (duplicates are outlined in red as you type).

Re-selecting a saved match reloads its data, so submitting again corrects a mistake in place.
**Clear This Match** removes one match; **Reset Entire Tournament** wipes everything.

Player names belong to the roster, not to a single match — type them once during Match 1 and they
carry across all three. Team names and 3-letter tags are edited in the right-hand sidebar.

### Leaderboard — for the stream and participants

- **Team Standings** — Rank, Team, MP, WWCD, Placement pts, Kills, Damage, Total. Gold champion row
  with an animated name and a trophy; silver and bronze medals on 2nd and 3rd.
- **Tournament MVP** — a glowing gold hero card with a crown for the top individual (name, team,
  kills, damage).
- **Top Fraggers** — Rank, Player, Team, MP, Kills, Damage, with a crowned `MVP` badge on #1. Shows
  the top 10, with a *Show all 24* toggle.
- **Match Breakdown** — one card per map showing each team's finish, kills and points, plus that
  map's top individual performance.

---

## Sharing the results

| Button | What it does |
|---|---|
| **⬇ Export PNG** | Renders the whole board (standings + MVP + breakdown) to a PNG and downloads it as `ddam-cup-standings-YYYY-MM-DD.png`. Best option for a group chat. |
| **🖨 Printable** | Opens the print dialog with a clean black-on-white layout — buttons and effects stripped. Print, or "Save as PDF". |
| **📋 Copy Text** | Copies a plain-text summary (standings + top 5 fraggers) to the clipboard for pasting straight into chat. |

---

## Data & storage

Results are saved to `localStorage` under the key **`ddam-cup-pubgm-v2`**, so a refresh mid-tournament
loses nothing. The data is per-browser and per-device — it is not synced anywhere, so run the whole
tournament from the same browser, and export a PNG as your durable record.

Shape:

```js
{
  teams: [ { id, name, tag, players: [ { id, name } x4 ] } x6 ],
  results: {
    1: { teamId: { rank, players: { playerId: { kills, damage } } } },  // absent = not played
    2: { ... },
    3: { ... }
  },
  updated: "ISO timestamp"
}
```

To back up or move a tournament, run this in the browser console and keep the output:

```js
copy(localStorage.getItem('ddam-cup-pubgm-v2'))
```

Restore it on another machine with:

```js
localStorage.setItem('ddam-cup-pubgm-v2', '<paste the JSON here>'); location.reload()
```

---

## Customising

All of the knobs are at the top of the `<script>` block in `index.html`:

```js
const PLACEMENT   = {1:10, 2:6, 3:5, 4:4, 5:2, 6:1};
const MAPS        = ['Sanhok', 'Livik', 'Erangel'];
const NUM_MATCHES = 3;
const NUM_TEAMS   = 6;
const SQUAD_SIZE  = 4;
const STORE_KEY   = 'ddam-cup-pubgm-v2';
```

Change the maps or the point values freely. If you change `NUM_MATCHES`, `NUM_TEAMS` or
`SQUAD_SIZE`, also bump `STORE_KEY` — saved data from the old shape is rejected on load, and a fresh
key avoids a stale-state surprise.

Theme colors are the Tailwind tokens near the top of the file: `ink` (`#0f172a` background),
`gold` (`#f59e0b`), `cyan` (`#22d3ee`), plus `panel` / `panel2` / `line` for surfaces.

### The background image

The arena backdrop is one CSS variable at the top of the `<style>` block:

```css
:root{
  --bg-photo: url('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=2400&q=80');
}
```

Point it at any image — a local file (`url('bg.jpg')`) works too. These Unsplash IDs are verified to
load and stay dark enough to keep white text crisp; swap the ID in the URL to use one:

| Photo ID | Look |
|---|---|
| `photo-1542751371-adc38448a05e` | esports player at a lit rig *(default)* |
| `photo-1470071459604-3b5ec3a7fe05` | misty highlands, Erangel-like terrain |
| `photo-1519669556878-63bdad8a1a49` | masked figure at night |
| `photo-1560253023-3ec5d502959f` | LAN arena, two players |
| `photo-1511512578047-dfb367046420` | dark arcade control room |

The readability overlay is the gradient in `body::before` —
`linear-gradient(rgba(15,23,42,.85), rgba(15,23,42,.92))`. Raise those alphas for a darker,
calmer backdrop; lower them to let more of the photo through.

### Icons

All icons are inline SVG in the `ICONS` object in the script — airdrop crate (header badge), trophy
(#1 team, section header, match winner), medal (#2 silver, #3 bronze), crown (MVP), skull (top
fraggers), map (match breakdown). No icon font and no remote asset, so they render identically in
the PNG export and the printable sheet. Recolor one by changing the Tailwind text color on its
wrapper — they all draw with `currentColor`.

### Two CSS gotchas worth preserving

> **The color token is named `ink`, not `base`.** Naming a custom color `base` makes Tailwind emit
> `.text-base` as a *color* utility, which silently overrides `text-white` on any element sized with
> `sm:text-base` — team names render nearly invisible.

> **Only `<html>` carries an opaque background colour.** The backdrop layers are `body::before` /
> `body::after` at negative z-index. An opaque `background-color` on `<body>` paints *after*
> negative-z-index children in the root stacking context, which hides the photo completely.

---

## Known limits

- Rosters are fixed at 4 players per team; there is no add/remove player UI.
- Players with 0 kills still appear in the Top Fraggers list, ranked at the bottom.
- Damage is entered manually per player — it is not derived from anything.
- No multi-device sync. One browser is the source of truth.
- The background photo is hotlinked from Unsplash; the page needs one online load to cache it.
  Download it next to `index.html` and point `--bg-photo` at the local file for a fully offline kit.
# pubg-mobile-cup-2026
