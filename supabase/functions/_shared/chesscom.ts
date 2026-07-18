// Minimal client for the chess.com public data API. Fetched SERVER-SIDE only
// (browsers strip the User-Agent): serial requests, a contact-bearing
// User-Agent, and ETag/Last-Modified conditional GETs. See docs/technical.md §5.

const CONTACT = Deno.env.get('CHESSCOM_CONTACT') ?? 'anonymous';
const USER_AGENT = `blitzkrieg/1.0 (+contact: ${CONTACT})`;
const BASE = 'https://api.chess.com/pub';

function get(url: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip', ...extraHeaders },
  });
}

export interface ChesscomProfile {
  player_id: number;
  username: string;
  url: string;
  name?: string;
  location?: string;
}

export interface ChesscomPlayer {
  rating: number;
  result: string;
  username: string;
  uuid?: string;
  '@id'?: string;
}

export interface ChesscomGame {
  uuid: string;
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  time_class: string;
  rules: string;
  white: ChesscomPlayer;
  black: ChesscomPlayer;
  eco?: string;
  fen?: string;
}

export interface MonthResult {
  status: 'ok' | 'notModified';
  etag?: string;
  lastModified?: string;
  games: ChesscomGame[];
}

export async function fetchProfile(username: string): Promise<ChesscomProfile | null> {
  const res = await get(`${BASE}/player/${encodeURIComponent(username)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`chess.com profile ${res.status}`);
  return (await res.json()) as ChesscomProfile;
}

/** Monthly archive URLs, oldest → newest. */
export async function listArchives(username: string): Promise<string[]> {
  const res = await get(`${BASE}/player/${encodeURIComponent(username)}/games/archives`);
  if (!res.ok) throw new Error(`chess.com archives ${res.status}`);
  const body = (await res.json()) as { archives?: string[] };
  return body.archives ?? [];
}

/** Conditional GET of one monthly archive (a full URL from listArchives). */
export async function fetchMonth(
  url: string,
  etag?: string | null,
  lastModified?: string | null,
): Promise<MonthResult> {
  const headers: Record<string, string> = {};
  if (etag) headers['If-None-Match'] = etag;
  if (lastModified) headers['If-Modified-Since'] = lastModified;
  const res = await get(url, headers);
  if (res.status === 304) return { status: 'notModified', games: [] };
  if (!res.ok) throw new Error(`chess.com month ${res.status} for ${url}`);
  const body = (await res.json()) as { games?: ChesscomGame[] };
  return {
    status: 'ok',
    etag: res.headers.get('etag') ?? undefined,
    lastModified: res.headers.get('last-modified') ?? undefined,
    games: body.games ?? [],
  };
}
