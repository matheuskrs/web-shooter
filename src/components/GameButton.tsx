import type { ComponentPropsWithRef } from 'react';
import { useUiClick } from '../hooks/useUiClick';

interface GameButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'secondary';
  size?: 'normal' | 'small';
}

/** A real <button> dressed in the official wooden button art (normal/hover/pressed/disabled). */
export function GameButton({ variant = 'primary', size = 'normal', className, onClick, type = 'button', ...rest }: GameButtonProps) {
  const click = useUiClick();
  const classes = ['game-button', `game-button--${variant}`, size === 'small' && 'game-button--small', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={classes}
      onClick={(event) => {
        click();
        onClick?.(event);
      }}
      {...rest}
    />
  );
}
