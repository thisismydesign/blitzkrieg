import type { Opening } from '../types';

/**
 * A small, curated set of standard openings. Each entry is a full line in SAN.
 *
 * Weights encode how often a line should appear:
 *  - Common main lines: 8–10
 *  - Solid but less frequent systems: 5–6
 *  - Offbeat / sub-optimal opponent replies: 1–3 (shown less often)
 *
 * Lines cover both colours so the user practises White and Black repertoires.
 * All sequences are validated for legality in openings.test.ts.
 */
export const OPENINGS: Opening[] = [
  // ---- User plays White ----
  {
    id: 'italian-main',
    name: 'Italian Game — Giuoco Piano',
    userSide: 'white',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3'],
    weight: 10,
    tag: 'Main line',
  },
  {
    id: 'ruy-lopez-main',
    name: 'Ruy Lopez — Closed',
    userSide: 'white',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3'],
    weight: 10,
    tag: 'Main line',
  },
  {
    id: 'queens-gambit-white',
    name: "Queen's Gambit Declined",
    userSide: 'white',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3'],
    weight: 8,
    tag: 'Main line',
  },
  {
    id: 'scotch-white',
    name: 'Scotch Game',
    userSide: 'white',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3'],
    weight: 6,
    tag: 'Main line',
  },
  {
    id: 'london-white',
    name: 'London System',
    userSide: 'white',
    moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4', 'e6', 'e3', 'Bd6', 'Bg3'],
    weight: 5,
    tag: 'System',
  },
  {
    id: 'scandinavian-white',
    name: 'Scandinavian Defence (vs offbeat ...d5)',
    userSide: 'white',
    moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Nf3'],
    weight: 3,
    tag: 'Sideline',
  },
  {
    id: 'philidor-white',
    name: 'Philidor Defence (passive ...d6)',
    userSide: 'white',
    moves: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Nxd4'],
    weight: 2,
    tag: 'Sideline',
  },
  {
    id: 'damiano-white',
    name: 'Damiano Defence (refuting ...f6)',
    userSide: 'white',
    moves: ['e4', 'e5', 'Nf3', 'f6', 'Nxe5', 'fxe5', 'Qh5+', 'Ke7', 'Qxe5+'],
    weight: 1,
    tag: 'Punish a blunder',
  },

  // ---- User plays Black ----
  {
    id: 'sicilian-najdorf',
    name: 'Sicilian Defence — Najdorf',
    userSide: 'black',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    weight: 9,
    tag: 'Main line',
  },
  {
    id: 'french-black',
    name: 'French Defence',
    userSide: 'black',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Be7'],
    weight: 6,
    tag: 'Main line',
  },
  {
    id: 'caro-kann-black',
    name: 'Caro-Kann Defence',
    userSide: 'black',
    moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'],
    weight: 6,
    tag: 'Main line',
  },
  {
    id: 'kings-indian-black',
    name: "King's Indian Defence",
    userSide: 'black',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O'],
    weight: 6,
    tag: 'Main line',
  },
  {
    id: 'alapin-black',
    name: 'Sicilian — Alapin (vs 2.c3)',
    userSide: 'black',
    moves: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4', 'Nf6'],
    weight: 3,
    tag: 'Sideline',
  },
  {
    id: 'bishops-opening-black',
    name: "Bishop's Opening (vs offbeat 2.Bc4)",
    userSide: 'black',
    moves: ['e4', 'e5', 'Bc4', 'Nf6', 'd3', 'c6'],
    weight: 2,
    tag: 'Sideline',
  },
];
