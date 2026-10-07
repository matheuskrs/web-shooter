import { useEffect, useRef, type ReactNode } from 'react';
import { useServices } from '../app/services';

interface DialogProps {
  open: boolean;
  labelledBy: string;
  /** Escape or the platform back gesture. */
  onCancel: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Native modal <dialog>: the browser traps focus, makes the page behind it
 * inert, restores focus on close and handles Escape. Content is drawn with
 * the official panel art.
 */
export function Dialog({ open, labelledBy, onCancel, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const { audio } = useServices();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      audio.play('ui_open', { volume: 0.4 });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, audio]);

  return (
    <dialog
      ref={ref}
      className={['dialog', className].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="panel dialog__panel">{children}</div>
    </dialog>
  );
}
