import { createContext, useContext } from 'react';
import { AssetLoader } from '../game/assets/AssetLoader';
import { AudioManager } from '../game/audio/AudioManager';
import { readTestOverrides } from '../game/testing/testApi';
import { WorldHost } from '../game/world/WorldHost';

/**
 * Long-lived, page-wide services. Created once in the composition root
 * (main.tsx) and handed down through context, so nothing reaches for a
 * hidden module singleton.
 */
export interface AppServices {
  audio: AudioManager;
  assets: AssetLoader;
  /** The page's single Pixi world: menu sea, matches and the camera. */
  world: WorldHost;
}

export function createAppServices(): AppServices {
  const audio = new AudioManager();
  const assets = new AssetLoader(audio);
  const overrides = readTestOverrides();
  const world = new WorldHost({ assets, audio, seed: overrides.seed, manualClock: overrides.manualClock });
  return { audio, assets, world };
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside ServicesContext');
  return services;
}
