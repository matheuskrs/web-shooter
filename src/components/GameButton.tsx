import type { ComponentPropsWithRef } from 'react';
import { useServices } from '../app/services';

interface GameButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'secondary';
  size?: 'normal' | 'small';
}

/** A real <button> dressed in the official wooden button art (normal/hover/pressed/disabled). */
export function GameButton({ variant = 'primary', size = 'normal', className, onClick, type = 'button', ...rest }: GameButtonProps) {
  const { audio } = useServices();
  const classes = ['game-button', `game-button--${variant}`, size === 'small' && 'game-button--small', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={classes}
      onClick={(event) => {
        audio.unlock();
        audio.play('ui_click', { volume: 0.5 });
        onClick?.(event);
      }}
      {...rest}
    />
  );
}
