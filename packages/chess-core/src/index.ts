// @blitzkrieg/chess-core — shared, framework-free chess logic used by both the
// web app and (where needed) the Supabase edge functions and tests: FEN/EPD
// position keys, PGN parsing, Lichess-constant move classification, opening/ECO
// lookup, mistake detection, and FSRS grading.
//
// Modules are added in the chess-core feature commit; this entry point re-exports
// them so consumers import from '@blitzkrieg/chess-core'.

export const CHESS_CORE_VERSION = '0.1.0';
