import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { PAGE_SIZE } from '../../api/contracts';
import { useHistoryQuery, useRankingQuery } from '../../api/queries';
import { GameButton } from '../../components/GameButton';
import { RoundButton } from '../../components/RoundButton';
import { notifyError, type ErrorSubject } from '../../components/toast/notify';
import { configKeyOf } from '../../game/config/gameConfig';
import { getPlayerId } from '../../storage/matchStorage';
import { gameOptionsOf, preferencesStore } from '../../storage/preferences';
import { useStoredValue } from '../../storage/storedValue';
import { formatClock, formatLogDate } from '../../utils/format';
import './log.css';

type Tab = 'ranking' | 'history';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match History' },
];

interface CaptainsLogScreenProps {
  tab: Tab;
  /** Switching tabs is navigation: the camera travels to the other part of the log. */
  onTab: (tab: Tab) => void;
  onBack: () => void;
}

export function CaptainsLogScreen({ tab, onTab, onBack }: CaptainsLogScreenProps) {
  // WAI-ARIA tabs: arrow keys select the other tab.
  const onTabKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onTab(tab === 'ranking' ? 'history' : 'ranking');
  };

  return (
    <main className="screen log-screen">
      <section className="panel log-panel" aria-labelledby="log-title">
        <h1 id="log-title" className="panel__title">
          Captain&apos;s Log
        </h1>
        <div className="log-panel__tabs" role="tablist" aria-label="Captain's log" onKeyDown={onTabKeyDown}>
          {TABS.map(({ id, label }) => (
            <GameButton
              key={id}
              id={`tab-${id}`}
              role="tab"
              size="small"
              variant={tab === id ? 'primary' : 'secondary'}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              // Arriving at the log puts keyboard focus on the selected tab.
              autoFocus={tab === id}
              onClick={() => {
                if (tab !== id) onTab(id);
              }}
            >
              {label}
            </GameButton>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="log-panel__body">
          {tab === 'ranking' ? <RankingTab /> : <HistoryTab />}
        </div>
        <div className="log-panel__footer">
          <GameButton variant="secondary" onClick={onBack}>
            Main Menu
          </GameButton>
        </div>
      </section>
    </main>
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
      subject="ranking"
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
      subject="history"
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
  subject: ErrorSubject;
  caption: string;
  headers: string[];
  query: {
    data: T | undefined;
    error: unknown;
    errorUpdatedAt: number;
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

/** Placeholder rows with the same height as real ones, so nothing shifts when data lands. */
function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }, (_, row) => (
        <tr key={row} className="log-table__skeleton" aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <td key={column}>
              <span className="skeleton-bar" style={{ width: `${[38, 72, 30, 58][column % 4]}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function LogTable<T extends PagedData>({ subject, caption, headers, query, emptyText, page, onPage, renderRows }: LogTableProps<T>) {
  const { data } = query;

  // Failures are reported once per failed attempt as a toast; the panel itself only offers Retry.
  useEffect(() => {
    if (query.errorUpdatedAt > 0) notifyError(subject, query.error);
  }, [query.errorUpdatedAt, query.error, subject]);

  const unreachable = query.isError && !data;
  const empty = data !== undefined && data.totalItems === 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="log-tab">
      <p className="log-tab__caption">{caption}</p>
      {unreachable ? (
        <div className="log-state">
          <p>The log is out of reach right now.</p>
          <GameButton size="small" onClick={() => void query.refetch()} disabled={query.isFetching}>
            Retry
          </GameButton>
        </div>
      ) : empty ? (
        <p className="log-state">{emptyText}</p>
      ) : (
        <table
          className={`log-table${query.isPlaceholderData ? ' log-table--paging' : ''}`}
          aria-busy={query.isPending || query.isPlaceholderData}
        >
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
          <tbody>{data ? renderRows(data) : <SkeletonRows columns={headers.length} />}</tbody>
        </table>
      )}
      {query.isPending && <span className="visually-hidden" role="status">Loading the log…</span>}
      {data && data.totalItems > 0 && (
        <nav className="pager" aria-label="Pages">
          <RoundButton icon="turn_left" label="Previous page" size={40} disabled={page <= 1} onClick={() => onPage(page - 1)} />
          <span className="pager__label" aria-live="polite">
            Page {data.page} of {totalPages}
          </span>
          <RoundButton icon="turn_right" label="Next page" size={40} disabled={page >= totalPages} onClick={() => onPage(page + 1)} />
        </nav>
      )}
    </div>
  );
}
