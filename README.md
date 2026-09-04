# 🏆 PUBG Mobile Tournament Leaderboard & Scoreboard

A modern, responsive web application designed for managing and tracking internal PUBG Mobile esports tournaments. It automatically calculates team rankings using the official PMGC point system, tracks individual player statistics, and highlights the overall tournament MVP — and syncs every score to **Firebase Realtime Database**, so the organiser publishes a match and every open leaderboard updates instantly, with no refresh.

---

## ✨ Features

- **Real-Time Sync**: Firebase Realtime Database keeps every viewer's standings, MVP card and top-fragger list live as the organiser enters results.
- **Official PMGC Point System**: Automatic calculation of Placement Points and Kill Points.
- **Dynamic Map Tracking**: Pre-configured for a 3-match custom layout (**Match 1: Sanhok**, **Match 2: Livik**, **Match 3: Erangel**).
- **Player-Level Statistics**: Input and track kills, damage, and individual performances per match.
- **Tournament MVP & Top Fraggers**: Automated leaderboards highlighting overall individual MVP and top players.
- **Tie-Breaker Logic**: Handles score ties based on Chicken Dinners (WWCD), total kills, and last match placements.
- **Export & Share Options**: Built-in screenshot/PNG export, printable view, and text-copy features for quick chat sharing.
- **Esports Dark Theme**: Dark-mode visual presentation inspired by esports tournament broadcast overlays.

---

## 🎮 Match & Point System Rules

### Placement Points
| Rank | Points |
| :--- | :--- |
| **1st (WWCD)** | **10 pts** |
| **2nd** | **6 pts** |
| **3rd** | **5 pts** |
| **4th** | **4 pts** |
| **5th** | **2 pts** |
| **6th** | **1 pt** |

### Kill Points
- **1 Kill** = **1 Point**

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js 18+** and npm (the app is bundled with Vite).
- A **Firebase project** with **Realtime Database** enabled (Firestore is a different product — this app needs Realtime Database).

### Installation & Local Run

1. Clone the repository:
   ```bash
   git clone https://github.com/Turuu8/pubg-mobile-cup-2026.git
   cd pubg-mobile-cup-2026
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your `.env` from the template and paste in your Firebase values:
   ```bash
   cp .env.example .env
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```
   The board is served at **http://localhost:5173** (and on your LAN IP, so phones in the room can open the leaderboard).

5. Build a static bundle for hosting:
   ```bash
   npm run build      # → dist/
   npm run preview    # serve the built bundle locally
   ```

---

## 🔥 Firebase Configuration

Values come from **Firebase console → Project settings → General → Your apps → SDK setup and configuration**, and are read through Vite's `import.meta.env`:

```js
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
```

`.env` is gitignored — never commit it. `.env.example` documents every key. Set the optional
`VITE_TOURNAMENT_ID` to run a rehearsal board alongside the real one.

### How the live sync works

Every client subscribes to `tournaments/<VITE_TOURNAMENT_ID>` with `onValue`. Pressing
**Add / Update Match Result** writes the board with `set`, and every open tab repaints immediately.

The header shows a status pill:

| Pill | Meaning |
| :--- | :--- |
| **LIVE** (green) | Connected — edits publish to everyone |
| **SYNC** (gold) | Configured, socket still connecting |
| **LOCAL** (grey) | No config, or connection failed — edits saved on this device only |

If a second organiser publishes while you are mid-edit, your typed values are **not** overwritten:
the leaderboard half of your screen updates, your inputs stay, and a banner offers **Load latest**.
Saving is last-write-wins, so agree who enters results.

### Data shape

```jsonc
{
  "teams":   [ { "id": "t1", "name": "...", "tag": "ALP", "players": [ { "id": "t1p1", "name": "..." } ] } ],
  "results": { "m1": { "t1": { "rank": 1, "players": { "t1p1": { "kills": 5, "damage": 1420 } } } } },
  "updated": "ISO timestamp"
}
```

Match keys are `m1`/`m2`/`m3`, **not** `1`/`2`/`3`, on purpose: Firebase turns an object with
consecutive integer keys into a JavaScript *array* on read, which would silently reshape `results`.
`src/firebase.js` translates between the two forms. An absent match key means "not played yet".

Back up a board straight from the database:

```bash
curl "$VITE_FIREBASE_DATABASE_URL/tournaments/ddam-cup-2026.json" > backup.json
```

---

## 🔒 Security

`VITE_*` variables are **inlined into the bundle at build time** — anyone who opens the page can
read them. That is expected for a Firebase web app: the API key identifies the project, it does not
authorise access. Database Rules are the real gate.

- **`database.rules.json`** — what the app works with today: public read, public write, plus
  validation that constrains rank to 1–6, bounds kills/damage, and rejects unknown fields. Anyone
  who knows the database URL can still overwrite scores; for an internal cup on an unshared URL
  that is usually an acceptable trade, but it is not locked down.
- **`database.rules.locked.json`** — public read, authenticated write. **Deploying this as-is will
  break the Admin view**, because the app does not sign in. To use it, enable an auth provider in
  Firebase and add a sign-in step before `publish()` in `src/store.js`.

Paste either into Firebase console → Realtime Database → Rules.

---

## 📁 Project Structure

```
index.html              Vite entry — markup only
src/
  main.js               render + event wiring (entry module)
  firebase.js           env-driven config, ref/set/onValue helpers
  store.js              live subscription, write-through publish, offline fallback
  scoring.js            PMGC points, standings and MVP ranking (pure functions)
  icons.js              inline SVG icon set
  config.js             maps, point table, team seed, tournament id
  style.css             theme, backdrop, glass panels, print rules
database.rules.json     Realtime Database rules
.env.example            Firebase config template
```

`localStorage` (key `ddam-cup-cache:<tournament id>`) mirrors the last known board. It paints the
page instantly before the first snapshot arrives and takes over if Firebase is unreachable, so a
network problem never locks the organiser out mid-tournament. It is a fallback, not the source of
truth.

---

## ⚙️ Customising

Tournament knobs live in `src/config.js`:

```js
export const PLACEMENT   = { 1:10, 2:6, 3:5, 4:4, 5:2, 6:1 };
export const MAPS        = ['Sanhok', 'Livik', 'Erangel'];
export const NUM_MATCHES = 3;
export const NUM_TEAMS   = 6;
export const SQUAD_SIZE  = 4;
```

Change maps or point values freely. If you change `NUM_TEAMS` or `SQUAD_SIZE`, also change
`VITE_TOURNAMENT_ID` — a board stored under the old shape is rejected on load (`isUsable` in
`src/store.js`), and a fresh id avoids a stale-state surprise.

The background photo is the `--bg-photo` variable at the top of `src/style.css`; the readability
overlay is the gradient in `body::before`. Icons are inline SVG in `src/icons.js`.

### Two CSS traps worth preserving

> **The colour token is named `ink`, not `base`.** Naming a custom colour `base` makes Tailwind emit
> `.text-base` as a *colour* utility, which silently overrides `text-white` on anything sized with
> `sm:text-base`.

> **Only `<html>` carries an opaque background colour.** The backdrop layers are `body::before` /
> `body::after` at negative z-index; an opaque background on `<body>` paints over them and hides the
> photo entirely.

---

## ⚠️ Known Limits

- No sign-in — anyone with the page can open the Admin view; Database Rules are the only gate.
- Concurrent admins are last-write-wins per save; the UI warns, it does not merge.
- Rosters are fixed at 4 players per team.
- Damage is entered manually per player.

---

Copyright © 2026 Ganbat Turmunkh
