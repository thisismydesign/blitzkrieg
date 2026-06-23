import { OPENINGS } from '../chess/openings';
import type { Settings, SideFilter } from '../types';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

const SIDES: { value: SideFilter; label: string }[] = [
  { value: 'random', label: 'Random' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
];

export function Options({ settings, onChange, onClose }: Props) {
  // Show openings relevant to the chosen side.
  const visible = OPENINGS.filter((o) => settings.side === 'random' || o.userSide === settings.side);

  const setSide = (side: SideFilter) => onChange({ ...settings, side, openings: [] });

  const toggleOpening = (id: string) => {
    const has = settings.openings.includes(id);
    const openings = has ? settings.openings.filter((x) => x !== id) : [...settings.openings, id];
    onChange({ ...settings, openings });
  };

  return (
    <Modal title="Options" onClose={onClose}>
      <section>
        <h3>Practise as</h3>
        <div className="segmented">
          {SIDES.map((s) => (
            <button
              key={s.value}
              className={settings.side === s.value ? 'seg active' : 'seg'}
              onClick={() => setSide(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Openings</h3>
        <p className="note">Leave all unchecked to mix everything.</p>
        <div className="checklist">
          {visible.map((o) => (
            <label key={o.id} className="check">
              <input
                type="checkbox"
                checked={settings.openings.includes(o.id)}
                onChange={() => toggleOpening(o.id)}
              />
              <span>
                {o.name} <em>· {o.userSide === 'white' ? 'W' : 'B'}</em>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3>Hints</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.autoHint}
            onChange={(e) => onChange({ ...settings, autoHint: e.target.checked })}
          />
          <span>Auto-show the piece to move after a delay</span>
        </label>
        <label className={`row ${settings.autoHint ? '' : 'disabled'}`}>
          <span>Delay</span>
          <input
            type="number"
            min={1}
            max={60}
            disabled={!settings.autoHint}
            value={settings.autoHintSeconds}
            onChange={(e) =>
              onChange({ ...settings, autoHintSeconds: Math.max(1, Number(e.target.value) || 1) })
            }
          />
          <span>seconds</span>
        </label>
      </section>

      <button className="btn-primary" onClick={onClose}>
        Done
      </button>
    </Modal>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
