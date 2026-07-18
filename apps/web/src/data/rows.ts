import type { Phase, Severity } from '@blitzkrieg/chess-core';

// Hand-written row types mirroring the migrations. (Supabase's `gen types` needs
// Docker, which is impractical on this machine; regenerate into a Database type
// when available and swap these out.)

export interface ChesscomAccountRow {
  id: string;
  user_id: string;
  chesscom_player_id: number;
  username: string;
  verified_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameRow {
  id: string;
  user_id: string;
  account_id: string;
  provider: string;
  provider_game_id: string;
  url: string | null;
  played_at: string | null;
  user_color: 'white' | 'black' | null;
  time_class: string | null;
  rules: string | null;
  rated: boolean | null;
  result_for_user: 'win' | 'loss' | 'draw' | null;
  user_rating: number | null;
  opponent_rating: number | null;
  opponent_username: string | null;
  eco: string | null;
  opening_name: string | null;
  opening_epd: string | null;
  pgn: string;
  analyzed_at: string | null;
  created_at: string;
}

export interface MistakeRow {
  id: string;
  user_id: string;
  game_id: string;
  ply: number;
  epd: string;
  fen: string;
  played_uci: string;
  played_san: string | null;
  best_uci: string;
  best_san: string | null;
  win_before: number;
  win_after: number;
  win_drop: number;
  severity: Severity;
  phase: Phase;
  lead_in_uci: string | null;
  created_at: string;
}

export interface ReviewCardRow {
  id: string;
  user_id: string;
  mistake_id: string;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  last_review: string | null;
  updated_at: string;
}
