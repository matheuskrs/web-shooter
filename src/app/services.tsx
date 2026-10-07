import { createContext, useContext, type ReactNode } from 'react';
import { AssetLoader } from '../game/assets/AssetLoader';
import { AudioManager } from '../game/audio/AudioManager';

/**
 * Long-lived, page-wide services. Created once in the composition root
 * (main.tsx) and handed down through context, so nothing reaches for a
 * hidden module singleton.
 */
export interface AppServices {
  audio: AudioManager;
  assets: AssetLoader;
}

export function createAppServices(): AppServices {
  const audio = new AudioManager();
  return { audio, assets: new AssetLoader(audio) };
}

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside ServicesProvider');
  return services;
}
