import { useSyncExternalStore } from 'react';

export interface StoredValue<T> {
  get(): T;
  set(value: T): void;
  update(change: (current: T) => T): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

/**
 * A typed, validated localStorage entry with change notifications. Corrupt
 * or outdated data falls back to the default instead of crashing; storage
 * being unavailable (private mode, quota) degrades to in-memory state.
 */
export function createStoredValue<T>(key: string, isValid: (value: unknown) => value is T, fallback: T): StoredValue<T> {
  const listeners = new Set<() => void>();
  let cache: T = read();

  function read(): T {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed: unknown = JSON.parse(raw);
      return isValid(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  function set(value: T) {
    cache = value;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the in-memory value; persistence is best effort.
    }
    notify();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key) return;
      cache = read();
      notify();
    });
  }

  return {
    get: () => cache,
    set,
    update: (change) => set(change(cache)),
    reset: () => {
      cache = fallback;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore unavailable storage.
      }
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStoredValue<T>(store: StoredValue<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
