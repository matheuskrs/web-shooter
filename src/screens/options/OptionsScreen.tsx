import { useState, type FormEvent } from 'react';
import { GameButton } from '../../components/GameButton';
import { RoundButton } from '../../components/RoundButton';
import {
  isValidSessionSeconds,
  isValidSpawnInterval,
  SESSION_SECONDS_LIMITS,
  SPAWN_INTERVAL_LIMITS,
} from '../../game/config/gameConfig';
import { CAPTAIN_NAME_MAX_LENGTH, isValidCaptainName, preferencesStore } from '../../storage/preferences';
import { useStoredValue } from '../../storage/storedValue';
import { NetworkSimulationPanel } from './NetworkSimulationPanel';
import './options.css';

interface Draft {
  sessionSeconds: string;
  spawnIntervalSeconds: string;
  captainName: string;
  muted: boolean;
}

function validate(draft: Draft) {
  const session = Number(draft.sessionSeconds);
  const spawn = Number(draft.spawnIntervalSeconds);
  return {
    sessionSeconds:
      draft.sessionSeconds.trim() !== '' && isValidSessionSeconds(session)
        ? null
        : `Use a whole number from ${SESSION_SECONDS_LIMITS.min} to ${SESSION_SECONDS_LIMITS.max} seconds.`,
    spawnIntervalSeconds:
      draft.spawnIntervalSeconds.trim() !== '' && isValidSpawnInterval(spawn)
        ? null
        : `Use ${SPAWN_INTERVAL_LIMITS.min} to ${SPAWN_INTERVAL_LIMITS.max} seconds, in steps of ${SPAWN_INTERVAL_LIMITS.step}.`,
    captainName: isValidCaptainName(draft.captainName) ? null : `Use 2 to ${CAPTAIN_NAME_MAX_LENGTH} characters.`,
  };
}

/** Moves to the next valid step in `direction`, snapping off-grid values (2.3 -> 2.5 going up). */
function stepValue(value: string, direction: 1 | -1, limits: { min: number; max: number; step: number }): string {
  const current = Number(value);
  const base = Number.isFinite(current) && value.trim() !== '' ? current : limits.min;
  const index = direction > 0 ? Math.floor(base / limits.step + 1e-9) + 1 : Math.ceil(base / limits.step - 1e-9) - 1;
  return String(Math.min(limits.max, Math.max(limits.min, index * limits.step)));
}

export function OptionsScreen({ onBack }: { onBack: () => void }) {
  const saved = useStoredValue(preferencesStore);
  const [draft, setDraft] = useState<Draft>(() => ({
    sessionSeconds: String(saved.sessionSeconds),
    spawnIntervalSeconds: String(saved.spawnIntervalSeconds),
    captainName: saved.captainName,
    muted: saved.muted,
  }));
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const errors = validate(draft);
  const valid = !errors.sessionSeconds && !errors.spawnIntervalSeconds && !errors.captainName;
  const dirty =
    draft.sessionSeconds !== String(saved.sessionSeconds) ||
    draft.spawnIntervalSeconds !== String(saved.spawnIntervalSeconds) ||
    draft.captainName !== saved.captainName ||
    draft.muted !== saved.muted;

  const change = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setStatus('idle');
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    preferencesStore.set({
      sessionSeconds: Number(draft.sessionSeconds),
      spawnIntervalSeconds: Number(draft.spawnIntervalSeconds),
      captainName: draft.captainName.trim(),
      muted: draft.muted,
    });
    setDraft((current) => ({ ...current, captainName: current.captainName.trim() }));
    setStatus('saved');
  };

  return (
    <>
      <div className="scene-backdrop" aria-hidden="true" />
      <main className="screen">
        <form className="panel options-panel" aria-labelledby="options-title" onSubmit={save} noValidate>
          <h1 id="options-title" className="panel__title">
            Options
          </h1>

          <StepperField
            id="session-seconds"
            label="Game session time"
            unit="s"
            value={draft.sessionSeconds}
            error={errors.sessionSeconds}
            hint={`${SESSION_SECONDS_LIMITS.min}–${SESSION_SECONDS_LIMITS.max} seconds`}
            step={SESSION_SECONDS_LIMITS.step}
            onChange={(value) => change({ sessionSeconds: value })}
            onStep={(direction) => change({ sessionSeconds: stepValue(draft.sessionSeconds, direction, SESSION_SECONDS_LIMITS) })}
          />
          <StepperField
            id="spawn-interval"
            label="Enemy spawn time"
            unit="s"
            value={draft.spawnIntervalSeconds}
            error={errors.spawnIntervalSeconds}
            hint={`${SPAWN_INTERVAL_LIMITS.min}–${SPAWN_INTERVAL_LIMITS.max} seconds between enemies`}
            step={SPAWN_INTERVAL_LIMITS.step}
            onChange={(value) => change({ spawnIntervalSeconds: value })}
            onStep={(direction) => change({ spawnIntervalSeconds: stepValue(draft.spawnIntervalSeconds, direction, SPAWN_INTERVAL_LIMITS) })}
          />

          <div className="options-field">
            <label htmlFor="captain-name" className="options-field__label">
              Captain name
            </label>
            <input
              id="captain-name"
              className="options-input options-input--text"
              value={draft.captainName}
              maxLength={CAPTAIN_NAME_MAX_LENGTH + 4}
              autoComplete="nickname"
              aria-invalid={errors.captainName !== null}
              aria-describedby={errors.captainName ? 'captain-name-error' : undefined}
              onChange={(event) => change({ captainName: event.target.value })}
            />
            {errors.captainName && (
              <p id="captain-name-error" className="options-field__error" role="alert">
                {errors.captainName}
              </p>
            )}
          </div>

          <label className="options-toggle">
            <input type="checkbox" checked={!draft.muted} onChange={(event) => change({ muted: !event.target.checked })} />
            <span>Sound effects</span>
          </label>

          <p className="options-note">Changes apply to the next battle.</p>
          <div className="options-actions">
            <GameButton type="submit" disabled={!valid || !dirty}>
              Save
            </GameButton>
            <GameButton variant="secondary" onClick={onBack}>
              Main Menu
            </GameButton>
          </div>
          <p className={`status-text${status === 'saved' ? ' status-text--success' : ''}`} role="status">
            {status === 'saved' ? 'Saved.' : ''}
          </p>

          <NetworkSimulationPanel />
        </form>
      </main>
    </>
  );
}

interface StepperFieldProps {
  id: string;
  label: string;
  unit: string;
  value: string;
  error: string | null;
  hint: string;
  step: number;
  onChange: (value: string) => void;
  onStep: (direction: 1 | -1) => void;
}

function StepperField({ id, label, unit, value, error, hint, step, onChange, onStep }: StepperFieldProps) {
  const described = [`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(' ');
  return (
    <div className="options-field">
      <label htmlFor={id} className="options-field__label">
        {label}
      </label>
      <div className="options-stepper">
        <RoundButton icon="minus" label={`Decrease ${label.toLowerCase()}`} size={44} onClick={() => onStep(-1)} />
        <span className="options-stepper__value">
          <input
            id={id}
            className="options-input"
            inputMode="decimal"
            type="number"
            step={step}
            value={value}
            aria-invalid={error !== null}
            aria-describedby={described}
            onChange={(event) => onChange(event.target.value)}
          />
          <span aria-hidden="true">{unit}</span>
        </span>
        <RoundButton icon="plus" label={`Increase ${label.toLowerCase()}`} size={44} onClick={() => onStep(1)} />
      </div>
      <p id={`${id}-hint`} className="options-field__hint">
        {hint}
      </p>
      {error && (
        <p id={`${id}-error`} className="options-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
