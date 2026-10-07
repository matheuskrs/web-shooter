import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/icons';

const CONTROLS: readonly { icons: IconName[]; keys: string[]; action: string }[] = [
  { icons: ['forward'], keys: ['W', '↑'], action: 'Sail' },
  { icons: ['turn_left', 'turn_right'], keys: ['A', 'D'], action: 'Steer' },
  { icons: ['fire_front'], keys: ['Space'], action: 'Bow cannon' },
  { icons: ['fire_left', 'fire_right'], keys: ['Q', 'E'], action: 'Broadsides' },
  { icons: ['pause'], keys: ['Esc', 'P'], action: 'Pause' },
];

export function ControlsReference() {
  return (
    <section className="controls-ref" aria-labelledby="controls-title">
      <h2 id="controls-title" className="controls-ref__title">
        Controls
      </h2>
      <ul className="controls-ref__list">
        {CONTROLS.map((control) => (
          <li key={control.action} className="controls-ref__item">
            <span className="controls-ref__icons" aria-hidden="true">
              {control.icons.map((icon) => (
                <Icon key={icon} name={icon} size={20} />
              ))}
            </span>
            <span className="controls-ref__keys">
              {control.keys.map((key, index) => (
                <kbd key={key} className="keycap" aria-label={index > 0 ? `or ${key}` : key}>
                  {key}
                </kbd>
              ))}
            </span>
            <span className="controls-ref__action">{control.action}</span>
          </li>
        ))}
      </ul>
      <p className="controls-ref__touch">On touch screens, steer with the helm on the left and fire with the cannons on the right.</p>
    </section>
  );
}
