// @blitzkrieg/chess-core — shared, framework-free chess logic used by both the
// web app and (where needed) the Supabase edge functions and tests: FEN/EPD
// position keys, PGN parsing, Lichess-constant move classification, game-phase
// heuristics, mistake detection, and FSRS grading.

export const CHESS_CORE_VERSION = '0.1.0';

export * from './types';
export * from './fen';
export * from './classify';
export * from './phase';
export * from './pgn';
export * from './mistakes';
export * from './fsrs';
