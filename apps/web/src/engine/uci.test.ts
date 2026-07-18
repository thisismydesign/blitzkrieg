import { describe, expect, it } from 'vitest';
import { parseBestmove, parseInfo, UciCollector } from './uci';

describe('parseInfo', () => {
  it('extracts depth, cp score, nodes, and the pv', () => {
    const info = parseInfo(
      'info depth 20 seldepth 27 multipv 1 score cp 34 nodes 1234567 nps 1500000 time 800 pv e2e4 e7e5 g1f3',
    );
    expect(info).toMatchObject({ depth: 20, multipv: 1, cp: 34, nodes: 1234567 });
    expect(info?.pv?.[0]).toBe('e2e4');
  });

  it('extracts a mate score', () => {
    expect(parseInfo('info depth 5 score mate 3 nodes 1000 pv d1h5')).toMatchObject({ mate: 3 });
  });

  it('returns null for non-info lines', () => {
    expect(parseInfo('bestmove e2e4')).toBeNull();
    expect(parseInfo('readyok')).toBeNull();
  });
});

describe('parseBestmove', () => {
  it('reads the best move, ignoring ponder', () => {
    expect(parseBestmove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
  });

  it('returns null for "(none)" and non-bestmove lines', () => {
    expect(parseBestmove('bestmove (none)')).toBeNull();
    expect(parseBestmove('info depth 1')).toBeNull();
  });
});

describe('UciCollector', () => {
  it('folds a search into a cp analysis, finalising on bestmove', () => {
    const c = new UciCollector();
    expect(c.push('info depth 10 score cp 20 nodes 5000 pv d2d4')).toBeNull();
    expect(c.push('info depth 18 multipv 1 score cp 41 nodes 900000 pv e2e4 e7e5')).toBeNull();
    const result = c.push('bestmove e2e4 ponder e7e5');
    expect(result).toMatchObject({ bestUci: 'e2e4', cp: 41, mate: null, depth: 18, knodes: 900 });
    expect(result?.lines).toEqual([{ uci: 'e2e4', cp: 41, mate: null }]);
  });

  it('captures a mate score and clears cp', () => {
    const c = new UciCollector();
    c.push('info depth 4 score cp 500 nodes 2000 pv d1h5');
    c.push('info depth 6 score mate 2 nodes 8000 pv d1h5 e8e7');
    const result = c.push('bestmove d1h5');
    expect(result).toMatchObject({ bestUci: 'd1h5', cp: null, mate: 2 });
  });

  it('collects MultiPV lines, best first', () => {
    const c = new UciCollector();
    c.push('info depth 18 multipv 1 score cp 30 nodes 100000 pv e2e4');
    c.push('info depth 18 multipv 2 score cp -50 nodes 100000 pv d2d4');
    const result = c.push('bestmove e2e4');
    expect(result).toMatchObject({ cp: 30, bestUci: 'e2e4' });
    expect(result?.lines).toEqual([
      { uci: 'e2e4', cp: 30, mate: null },
      { uci: 'd2d4', cp: -50, mate: null },
    ]);
  });
});
