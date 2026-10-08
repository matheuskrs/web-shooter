import { resolveValue, Toaster } from 'react-hot-toast';
import './toast.css';

/**
 * Bottom-centre notifications drawn on the wooden toast frame. The custom
 * render replaces react-hot-toast's default card entirely; its live-region
 * attributes (`ariaProps`) are kept so screen readers still hear them.
 */
export function PirateToaster() {
  return (
    <Toaster position="bottom-center" gutter={8} containerClassName="pirate-toaster">
      {(t) => (
        <div className={`pirate-toast ${t.visible ? 'pirate-toast--in' : 'pirate-toast--out'}`} {...t.ariaProps}>
          <span className="pirate-toast__text">{resolveValue(t.message, t)}</span>
        </div>
      )}
    </Toaster>
  );
}
