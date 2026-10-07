import type { ButtonHTMLAttributes } from 'react';
import { useServices } from '../app/services';
import { Icon } from './Icon';
import type { IconName } from './icons';

interface RoundButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Accessible name; the icon itself is decorative. */
  label: string;
  size?: number;
  silent?: boolean;
}

export function RoundButton({ icon, label, size = 52, silent = false, className, style, onClick, type = 'button', ...rest }: RoundButtonProps) {
  const { audio } = useServices();
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={['round-button', className].filter(Boolean).join(' ')}
      style={{ ...style, ['--size' as string]: `${size}px` }}
      onClick={(event) => {
        audio.unlock();
        if (!silent) audio.play('ui_click', { volume: 0.45 });
        onClick?.(event);
      }}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
