import { useState, type PointerEvent } from 'react';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/icons';
import type { GameAction, InputState } from '../../game/input/InputState';

interface HoldButtonProps {
  action: GameAction;
  icon: IconName;
  label: string;
  input: InputState;
  disabled: boolean;
}

/**
 * Press-and-hold control. Each button captures its own pointer, so one
 * thumb can steer while the other fires; the source id keeps a finger and a
 * keyboard key from releasing each other's hold.
 */
function HoldButton({ action, icon, label, input, disabled }: HoldButtonProps) {
  const [held, setHeld] = useState(false);
  const source = `touch:${action}`;

  const press = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    input.press(action, source);
    setHeld(true);
  };
  const release = () => {
    input.release(action, source);
    setHeld(false);
  };

  return (
    <button
      type="button"
      className="round-button touch-controls__button"
      aria-label={label}
      // Keyboard players have dedicated keys; these buttons are for touch.
      tabIndex={-1}
      data-held={held}
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Icon name={icon} />
    </button>
  );
}

export function TouchControls({ input, disabled }: { input: InputState; disabled: boolean }) {
  return (
    <div className="touch-controls" data-testid="touch-controls">
      <div className="touch-controls__cluster touch-controls__cluster--helm" role="group" aria-label="Steering">
        <HoldButton action="turnLeft" icon="turn_left" label="Turn left" input={input} disabled={disabled} />
        <HoldButton action="forward" icon="forward" label="Sail forward" input={input} disabled={disabled} />
        <HoldButton action="turnRight" icon="turn_right" label="Turn right" input={input} disabled={disabled} />
      </div>
      <div className="touch-controls__cluster touch-controls__cluster--guns" role="group" aria-label="Cannons">
        <HoldButton action="fireLeft" icon="fire_left" label="Fire port broadside" input={input} disabled={disabled} />
        <HoldButton action="fireFront" icon="fire_front" label="Fire bow cannon" input={input} disabled={disabled} />
        <HoldButton action="fireRight" icon="fire_right" label="Fire starboard broadside" input={input} disabled={disabled} />
      </div>
    </div>
  );
}
