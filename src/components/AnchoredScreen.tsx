import { useEffect, useRef, type ReactNode } from 'react';
import { useServices } from '../app/services';
import type { WorldLocation } from '../game/world/attractLayout';

interface AnchoredScreenProps {
  location: WorldLocation;
  /** False while the camera flies away from this screen: visible, but not interactive. */
  active: boolean;
  children: ReactNode;
}

/**
 * A screen that lives at a place in the world. The WorldHost moves and scales
 * this layer with the camera every frame (a direct style write), so the panel
 * shrinks away as the camera pulls back and grows into view as it arrives.
 * React only renders it when the screen itself changes.
 */
export function AnchoredScreen({ location, active, children }: AnchoredScreenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { world } = useServices();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return world.attachUi(element, location);
  }, [world, location]);

  return (
    <div ref={ref} className="anchored-screen" inert={!active} aria-hidden={!active || undefined}>
      {children}
    </div>
  );
}
