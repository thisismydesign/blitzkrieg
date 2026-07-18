import { describe, expect, it, vi } from 'vitest';
import { analyzeGame } from './analyzeGame';
import { parseGame } from './pgn';
import { toEpd } from './fen';
import type { Eval } from './types';

// Fool's mate: White's 2.g4?? walks into 2...Qh4#. White (user) blunders at ply 2.
const PGN = '1. f3 e5 2. g4 Qh4#';
const nodes = parseGame(PGN);

/** Even everywhere, except the position after 2.g4 where Black has forced mate. */
function evalMap(): Map<string, Eval> {
  const m = new Map<string, Eval>();
  for (const n of nodes) m.set(n.epd, { cp: 0, mate: null, bestUci: 'e2e4' });
  m.set(nodes[2].epd, { cp: 0, mate: null, bestUci: 'e2e4' }); // before g4, best ≠ g4
  m.set(nodes[3].epd, { cp: null, mate: 1, bestUci: 'd8h4' }); // Black to move, mate in 1
  return m;
}

describe('analyzeGame', () => {
  it('evaluates every position and derives the user mistakes', async () => {
    const m = evalMap();
    const analyze = vi.fn(async (fen: string) => m.get(toEpd(fen))!);

    const { nodes: outNodes, evals, mistakes } = await analyzeGame(PGN, 'w', { analyze });

    expect(outNodes).toHaveLength(nodes.length);
    expect(evals).toHaveLength(nodes.length);
    expect(analyze).toHaveBeenCalledTimes(nodes.length);

    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]).toMatchObject({ ply: 2, severity: 'blunder', bestUci: 'e2e4' });
  });

  it('uses the cache to skip the engine and still reports every eval', async () => {
    const m = evalMap();
    const analyze = vi.fn(async (fen: string) => m.get(toEpd(fen))!);
    const onEval = vi.fn();
    // Serve the first position from cache.
    const getCached = (epd: string) => (epd === nodes[0].epd ? m.get(epd) : null);

    await analyzeGame(PGN, 'w', { analyze, getCached, onEval });

    expect(analyze).toHaveBeenCalledTimes(nodes.length - 1);
    expect(onEval).toHaveBeenCalledTimes(nodes.length);
    expect(onEval.mock.calls[0][2]).toBe(true); // first eval came from cache
  });
});
