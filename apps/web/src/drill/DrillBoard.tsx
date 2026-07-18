import { useEffect, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
import type { MistakeDrill } from './MistakeDrill';

interface Props {
  drill: MistakeDrill;
  /** Called after each attempt so the parent can re-render / detect a solve. */
  onChange: () => void;
}

const LEAD_FROM = { background: 'rgba(255, 215, 64, 0.20)' };
const LEAD_TO = { background: 'rgba(255, 215, 64, 0.35)' };
const WRONG = { background: 'rgba(255, 80, 80, 0.45)' };
const GOOD_FROM = { background: 'rgba(80, 220, 120, 0.40)' };
const GOOD_TO = { background: 'rgba(80, 220, 120, 0.55)' };
const HINT = { background: 'rgba(80, 200, 255, 0.45)' };

export function DrillBoard({ drill, onChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const v = drill.view();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function onDrop(from: Square, to: Square): boolean {
    if (v.status === 'solved') return false;
    const r = drill.tryMove(from, to);
    onChange();
    return r.accepted;
  }

  const styles: Record<string, Record<string, string | number>> = {};
  if (v.leadIn) {
    styles[v.leadIn.from] = { ...LEAD_FROM };
    styles[v.leadIn.to] = { ...LEAD_TO };
  }
  if (v.status === 'playing' && v.lastWrong) styles[v.lastWrong.to] = { ...WRONG };
  if (v.status === 'playing' && v.hintFrom) styles[v.hintFrom] = { ...HINT };
  if (v.solved) {
    styles[v.solved.from] = { ...GOOD_FROM };
    styles[v.solved.to] = { ...GOOD_TO };
  }

  return (
    <div className="board" ref={wrapRef}>
      <Chessboard
        position={v.fen}
        boardWidth={width}
        boardOrientation={v.orientation}
        arePiecesDraggable={v.status === 'playing'}
        onPieceDrop={onDrop}
        customSquareStyles={styles}
        customBoardStyle={{ borderRadius: '8px' }}
        customDarkSquareStyle={{ backgroundColor: '#6f7da3' }}
        customLightSquareStyle={{ backgroundColor: '#dfe3f0' }}
        animationDuration={150}
      />
    </div>
  );
}
