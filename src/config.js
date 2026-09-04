/* ============================================================
   TOURNAMENT CONFIG
   The competition rules live here and nowhere else.
============================================================ */
export const PLACEMENT   = { 1:10, 2:6, 3:5, 4:4, 5:2, 6:1 };
export const MAPS        = ['Sanhok', 'Livik', 'Erangel'];   // Match 1, 2, 3
export const NUM_MATCHES = 3;
export const NUM_TEAMS   = 6;
export const SQUAD_SIZE  = 4;

export const TEAM_SEED = [
  ['Team Alpha','ALP'], ['Team Bravo','BRV'], ['Team Charlie','CHR'],
  ['Team Delta','DLT'], ['Team Echo','ECH'],  ['Team Foxtrot','FOX'],
];

/* Which board this client reads and writes. Change VITE_TOURNAMENT_ID to run a
   second board (a rehearsal, or next year's cup) against the same project. */
export const TOURNAMENT_ID = import.meta.env.VITE_TOURNAMENT_ID || 'ddam-cup-2026';

/* Local mirror key. Used as the offline fallback when Firebase is unreachable
   or unconfigured, and as a warm cache so the board paints before the first
   snapshot arrives. */
export const CACHE_KEY = `ddam-cup-cache:${TOURNAMENT_ID}`;
