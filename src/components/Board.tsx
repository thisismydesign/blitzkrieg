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
}

const LAST_MOVE = { background: 'rgba(255, 215, 64, 0.35)' };
const SELECTED = { background: 'rgba(80, 200, 255, 0.45)' };
const CORRECT = { boxShadow: 'inset 0 0 0 4px rgba(80, 220, 120, 0.9)' };
const HINT = { boxShadow: 'inset 0 0 0 4px rgba(150, 130, 255, 0.95)' };
const HINT_TARGET = { background: 'radial-gradient(rgba(150,130,255,0.85) 22%, transparent 24%)' };

export function Board({ state, onAttempt, hintLevel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [selected, setSelected] = useState<Square | ''>('');

  const game = useMemo(() => new Chess(state.fen), [state.fen]);
  const userColor = state.orientation === 'white' ? 'w' : 'b';

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function onPieceDrop(source: Square, target: Square): boolean {
    if (!state.isUserTurn) return false;
    setSelected('');
    return onAttempt(source, target).accepted;
  }

  function onSquareClick(square: Square): void {
    if (!state.isUserTurn) return;
    const piece = game.get(square);
    if (selected === '' || (piece && piece.color === userColor)) {
      setSelected(piece && piece.color === userColor ? square : '');
      if (selected !== '' && square === selected) setSelected('');
      return;
    }
    onAttempt(selected, square);
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
    if (selected) styles[selected] = { ...(styles[selected] ?? {}), ...SELECTED };
    if (state.errorHint) {
      // After a wrong move, always show the full correct move in green.
      styles[state.errorHint.from] = { ...(styles[state.errorHint.from] ?? {}), ...CORRECT };
      styles[state.errorHint.to] = { ...(styles[state.errorHint.to] ?? {}), ...CORRECT };
    }
    return styles;
  }, [state.lastMove, state.errorHint, state.expected, selected, hintLevel]);

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
    </div>
  );
}
