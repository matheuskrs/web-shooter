import toast from 'react-hot-toast';
import { toApiError } from '../../api/client';

export type ErrorSubject = 'ranking' | 'history' | 'register';

const SUBJECT_MESSAGES: Readonly<Record<ErrorSubject, string>> = {
  ranking: "Couldn't load the ranking. Try again.",
  history: "Couldn't load match history. Try again.",
  register: "Match result couldn't be submitted.",
};

const TOAST_DURATION_MS = 3600;

/**
 * Player-facing wording for a failed request. Technical details (status
 * codes, Axios messages) never reach the toast; they stay in the network
 * simulation panel for developers.
 */
export function playerMessage(subject: ErrorSubject, error: unknown): string {
  return toApiError(error).kind === 'network' ? 'Connection unavailable.' : SUBJECT_MESSAGES[subject];
}

/**
 * One toast per subject: a repeated failure replaces the visible toast
 * (same id) instead of stacking another one.
 */
export function notifyError(subject: ErrorSubject, error: unknown): void {
  toast.error(playerMessage(subject, error), { id: `error:${subject}`, duration: TOAST_DURATION_MS });
}
