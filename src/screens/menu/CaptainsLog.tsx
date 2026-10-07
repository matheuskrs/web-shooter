import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useHistoryQuery, useRankingQuery } from '../../api/queries';
import { errorMessage } from '../../api/queryClient';
import { GameButton } from '../../components/GameButton';
import { RoundButton } from '../../components/RoundButton';
import { configKeyOf } from '../../game/config/gameConfig';
import { getPlayerId } from '../../storage/matchStorage';
import { gameOptionsOf, preferencesStore } from '../../storage/preferences';
import { useStoredValue } from '../../storage/storedValue';
import { formatClock, formatLogDate } from '../../utils/format';

type Tab = 'ranking' | 'history';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match History' },
];

export function CaptainsLog() {
  const [tab, setTab] = useState<Tab>('ranking');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ ranking: null, history: null });

  // WAI-ARIA tabs: arrow keys move between tabs.
  const onTabKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: Tab = tab === 'ranking' ? 'history' : 'ranking';
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="panel log-panel" aria-labelledby="log-title">
      <h2 id="log-title" className="panel__title">
        Captain&apos;s Log
      </h2>
      <div className="log-panel__tabs" role="tablist" aria-label="Captain's log" onKeyDown={onTabKeyDown}>
        {TABS.map(({ id, label }) => (
          <GameButton
            key={id}
            ref={(element) => {
              tabRefs.current[id] = element;
            }}
            id={`tab-${id}`}
            role="tab"
            size="small"
            variant={tab === id ? 'primary' : 'secondary'}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
          >
            {label}
          </GameButton>
        ))}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="log-panel__body">
        {/* Each tab mounts its query when shown, so returning to it revalidates (staleTime 0) while cached rows show instantly. */}
        {tab === 'ranking' ? <RankingTab /> : <HistoryTab />}
      </div>
    </section>
  );
}

function RankingTab() {
  const preferences = useStoredValue(preferencesStore);
  const options = gameOptionsOf(preferences);
  const configKey = configKeyOf(options);
  const playerId = getPlayerId();
  const [page, setPage] = useState(1);
  const query = useRankingQuery(configKey, page);

  return (
    <LogTable
      caption={`${options.sessionSeconds} second battles · ${options.spawnIntervalSeconds} second spawns`}
      headers={['Rank', 'Captain', 'Points', 'Played']}
      query={query}
      emptyText="No battles logged for this setup yet. Be the first."
      page={page}
      onPage={setPage}
      renderRows={(data) =>
        data.items.map((entry) => {
          const mine = entry.playerId === playerId;
          const played = formatLogDate(entry.playedAt);
          return (
            <tr key={entry.matchId} className={mine ? 'log-table__row--mine' : undefined}>
              <td className="log-table__rank">{String(entry.rank).padStart(2, '0')}</td>
              <td>
                {entry.playerName}
                {mine && <span className="log-table__you">You</span>}
              </td>
              <td className="log-table__score">{entry.score}</td>
              <td className="log-table__muted">
                {played.date} · {played.time}
              </td>
            </tr>
          );
        })
      }
    />
  );
}

function HistoryTab() {
  const preferences = useStoredValue(preferencesStore);
  const [page, setPage] = useState(1);
  const query = useHistoryQuery(getPlayerId(), page);

  return (
    <LogTable
      caption={`${preferences.captainName} · your recent battles`}
      headers={['Date', 'Points', 'Duration', 'Result']}
      query={query}
      emptyText="No battles yet. Your finished matches will be logged here."
      page={page}
      onPage={setPage}
      renderRows={(data) =>
        data.items.map((record) => {
          const played = formatLogDate(record.playedAt);
          return (
            <tr key={record.matchId}>
              <td>
                {played.date} <span className="log-table__muted">· {played.time}</span>
              </td>
              <td className="log-table__score">{record.score}</td>
              <td>{formatClock(record.durationSeconds)}</td>
              <td className={record.endReason === 'defeated' ? 'log-table__defeated' : 'log-table__timeup'}>
                {record.endReason === 'defeated' ? 'Defeated' : 'Time up'}
              </td>
            </tr>
          );
        })
      }
    />
  );
}

interface PagedData {
  items: unknown[];
  page: number;
  totalPages: number;
  totalItems: number;
}

interface LogTableProps<T extends PagedData> {
  caption: string;
  headers: string[];
  query: {
    data: T | undefined;
    error: unknown;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    refetch: () => unknown;
  };
  emptyText: string;
  page: number;
  onPage: (page: number) => void;
  renderRows: (data: T) => ReactNode;
}

function LogTable<T extends PagedData>({ caption, headers, query, emptyText, page, onPage, renderRows }: LogTableProps<T>) {
  const { data } = query;
  const busy = query.isFetching;
  let body: ReactNode;

  if (query.isPending) {
    body = (
      <p className="log-state" role="status">
        Unrolling the charts…
      </p>
    );
  } else if (query.isError && !data) {
    body = (
      <div className="log-state log-state--error" role="alert">
        <p>Couldn&apos;t load the log: {errorMessage(query.error)}</p>
        <GameButton size="small" onClick={() => void query.refetch()}>
          Retry
        </GameButton>
      </div>
    );
  } else if (data && data.totalItems === 0) {
    body = <p className="log-state">{emptyText}</p>;
  } else if (data) {
    body = (
      <table className={`log-table${query.isPlaceholderData ? ' log-table--stale' : ''}`} aria-busy={busy}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{renderRows(data)}</tbody>
      </table>
    );
  }

  const totalPages = data?.totalPages ?? 1;
  return (
    <div className="log-tab">
      <p className="log-tab__caption" aria-hidden="true">
        {caption}
        <span className={`log-tab__sync${busy && !query.isPending ? ' log-tab__sync--active' : ''}`} role="status">
          {busy && !query.isPending ? 'Updating…' : ''}
        </span>
      </p>
      {query.isError && data && (
        <p className="log-state log-state--inline" role="alert">
          Showing saved rows; refresh failed ({errorMessage(query.error)}).{' '}
          <button type="button" className="link-button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      )}
      {body}
      {data && data.totalItems > 0 && (
        <nav className="pager" aria-label="Pages">
          <RoundButton icon="turn_left" label="Previous page" size={40} disabled={page <= 1} onClick={() => onPage(page - 1)} />
          <span className="pager__label" aria-live="polite">
            Page {data.page} of {totalPages}
          </span>
          <RoundButton
            icon="turn_right"
            label="Next page"
            size={40}
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
          />
        </nav>
      )}
    </div>
  );
}
