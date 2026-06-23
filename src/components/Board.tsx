import { useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { AttemptResult, EngineState } from '../chess/engine';

interface Props {
  state: EngineState;
  onAttempt: (from: string, to: string) => AttemptResult;
  /** Called on a wrong-piece touch; returns the correct piece's square (or null). */
  onWrongPiece: () => string | null;
  /** Hint reveal request (from the Hint button / auto-hint); blips on a square. */
  hintBlip: { square: string; id: number } | null;
  /** Reveal the correct move after a wrong attempt. */
  assist: boolean;
}

const LAST_MOVE = { background: 'rgba(255, 215, 64, 0.35)' };
const SELECTED = { background: 'rgba(80, 200, 255, 0.45)' };

type Mark = { square: Square; kind: 'good' | 'bad' | 'alt' | 'hint' };

/** Pixel offset of a square's top-left, accounting for board orientation. */
function squareOffset(square: Square, orientation: 'white' | 'black', size: number) {
  const file = square.charCodeAt(0) - 97; // a..h -> 0..7
  const rank = Number(square[1]); // 1..8
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 8 - rank : rank - 1;
  return { left: col * size, top: row * size };
}

export function Board({ state, onAttempt, onWrongPiece, hintBlip, assist }: Props) {
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

  function show(marks: Mark[]) {
    setBlips((prev) => ({ id: prev.id + 1, marks }));
  }

  // Flash blips: green on the played square, teal on equally-correct alternatives
  // (and their piece if different), red on a wrong square + a green hint on the
  // correct square when "give hint when incorrect" is on.
  function flash(target: Square, result: AttemptResult) {
    if (!result.legal) return; // impossible drag already snaps back
    if (result.accepted && result.played) {
      const marks: Mark[] = [{ square: result.played.to as Square, kind: 'good' }];
      for (const alt of result.alternatives ?? []) {
        marks.push({ square: alt.to as Square, kind: 'alt' });
        if (alt.from !== result.played.from) marks.push({ square: alt.from as Square, kind: 'alt' });
      }
      show(marks);
      return;
    }
    const marks: Mark[] = [{ square: target, kind: 'bad' }];
    if (assist && result.hint) marks.push({ square: result.hint.square as Square, kind: 'hint' });
    show(marks);
  }

  // A wrong piece can't make a book move: flag the error and hint the right piece.
  function wrongPiece(square: Square) {
    setSelected('');
    const correct = onWrongPiece();
    const marks: Mark[] = [{ square, kind: 'bad' }];
    if (assist && correct) marks.push({ square: correct as Square, kind: 'hint' });
    show(marks);
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
    const isOwnPiece = game.get(square)?.color === userColor;

    if (selected === '') {
      if (!isOwnPiece) return; // tapping an empty/opponent square does nothing
      if (state.correctFroms.includes(square)) setSelected(square);
      else wrongPiece(square);
      return;
    }
    if (square === selected) {
      setSelected('');
      return;
    }
    if (isOwnPiece) {
      // Switching pieces: only another book piece is selectable.
      if (state.correctFroms.includes(square)) setSelected(square);
      else wrongPiece(square);
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
    if (selected) styles[selected] = { ...(styles[selected] ?? {}), ...SELECTED };
    return styles;
  }, [state.lastMove, selected]);

  const size = width / 8;

  return (
    <div className="board" ref={wrapRef}>
      <Chessboard
        position={state.fen}
        boardWidth={width}
        boardOrientation={state.orientation}
        arePiecesDraggable={state.isUserTurn}
        isDraggablePiece={({ sourceSquare }) => state.correctFroms.includes(sourceSquare)}
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
      {hintBlip && (
        <span
          key={`hint-${hintBlip.id}`}
          className="blip blip-guide"
          style={{
            ...squareOffset(hintBlip.square as Square, state.orientation, size),
            width: size,
            height: size,
          }}
        />
      )}
    </div>
  );
}
