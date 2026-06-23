import { useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { AttemptResult, EngineState } from '../chess/engine';

interface Props {
  state: EngineState;
  onAttempt: (from: string, to: string) => AttemptResult;
  /** 0 = no hint, 1 = show the piece to move, 2 = also show the destination. */
  hintLevel: number;
  /** Reveal the correct move after a wrong attempt. */
  assist: boolean;
}

const LAST_MOVE = { background: 'rgba(255, 215, 64, 0.35)' };
const SELECTED = { background: 'rgba(80, 200, 255, 0.45)' };
const HINT = { boxShadow: 'inset 0 0 0 4px rgba(150, 130, 255, 0.95)' };
const HINT_TARGET = { background: 'radial-gradient(rgba(150,130,255,0.85) 22%, transparent 24%)' };
const CORRECT = { boxShadow: 'inset 0 0 0 4px rgba(80, 220, 120, 0.95)' };

type Mark = { square: Square; kind: 'good' | 'bad' | 'alt' };

/** Pixel offset of a square's top-left, accounting for board orientation. */
function squareOffset(square: Square, orientation: 'white' | 'black', size: number) {
  const file = square.charCodeAt(0) - 97; // a..h -> 0..7
  const rank = Number(square[1]); // 1..8
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 8 - rank : rank - 1;
  return { left: col * size, top: row * size };
}

export function Board({ state, onAttempt, hintLevel, assist }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [selected, setSelected] = useState<Square | ''>('');
  const [blips, setBlips] = useState<{ id: number; marks: Mark[] }>({ id: 0, marks: [] });

  const game = useMemo(() => new Chess(state.fen), [state.fen]);
  const userColor = state.orientation === 'white' ? 'w' : 'b';

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Flash blips: green on the played square, teal on equally-correct alternatives
  // (and their piece if different), red on a wrong square.
  function flash(target: Square, result: AttemptResult) {
    if (!result.legal) return; // impossible drag already snaps back
    const marks: Mark[] = [];
    if (result.accepted && result.played) {
      marks.push({ square: result.played.to as Square, kind: 'good' });
      for (const alt of result.alternatives ?? []) {
        marks.push({ square: alt.to as Square, kind: 'alt' });
        if (alt.from !== result.played.from) marks.push({ square: alt.from as Square, kind: 'alt' });
      }
    } else {
      marks.push({ square: target, kind: 'bad' });
    }
    setBlips((prev) => ({ id: prev.id + 1, marks }));
  }

  function onPieceDrop(source: Square, target: Square): boolean {
    if (!state.isUserTurn) return false;
    setSelected('');
    const result = onAttempt(source, target);
    flash(target, result);
    return result.accepted;
  }

  function onSquareClick(square: Square): void {
    if (!state.isUserTurn) return;
    const piece = game.get(square);
    if (selected === '' || (piece && piece.color === userColor)) {
      setSelected(piece && piece.color === userColor ? square : '');
      if (selected !== '' && square === selected) setSelected('');
      return;
    }
    flash(square, onAttempt(selected, square));
    setSelected('');
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, Record<string, string | number>> = {};
    if (state.lastMove) {
      styles[state.lastMove.from] = { ...LAST_MOVE };
      styles[state.lastMove.to] = { ...LAST_MOVE };
    }
    if (hintLevel >= 1 && state.expected) {
      styles[state.expected.from] = { ...(styles[state.expected.from] ?? {}), ...HINT };
      if (hintLevel >= 2) {
        styles[state.expected.to] = { ...(styles[state.expected.to] ?? {}), ...HINT_TARGET };
      }
    }
    if (assist && state.errorHint) {
      styles[state.errorHint.from] = { ...(styles[state.errorHint.from] ?? {}), ...CORRECT };
      styles[state.errorHint.to] = { ...(styles[state.errorHint.to] ?? {}), ...CORRECT };
    }
    if (selected) styles[selected] = { ...(styles[selected] ?? {}), ...SELECTED };
    return styles;
  }, [state.lastMove, state.expected, state.errorHint, selected, hintLevel, assist]);

  const size = width / 8;

  return (
    <div className="board" ref={wrapRef}>
      <Chessboard
        position={state.fen}
        boardWidth={width}
        boardOrientation={state.orientation}
        arePiecesDraggable={state.isUserTurn}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        customSquareStyles={squareStyles}
        customBoardStyle={{ borderRadius: '8px' }}
        customDarkSquareStyle={{ backgroundColor: '#6f7da3' }}
        customLightSquareStyle={{ backgroundColor: '#dfe3f0' }}
        animationDuration={150}
      />
      {blips.marks.map((m, i) => (
        <span
          key={`${blips.id}-${i}`}
          className={`blip blip-${m.kind}`}
          style={{ ...squareOffset(m.square, state.orientation, size), width: size, height: size }}
        />
      ))}
    </div>
  );
}
