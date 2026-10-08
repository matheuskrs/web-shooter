import { useEffect, useRef } from 'react';
import { useServices } from '../app/services';

/**
 * Fixed layer behind every screen that hosts the page's single Pixi canvas.
 * The host outlives this component; mounting only attaches and detaches the
 * canvas, so React Strict Mode's double mount is harmless.
 */
export function WorldCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const { world } = useServices();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    world.mount(element);
    return () => world.unmount(element);
  }, [world]);

  return <div ref={ref} className="world-canvas" aria-hidden="true" />;
}
