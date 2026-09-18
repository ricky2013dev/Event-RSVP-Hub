import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GripVertical, LayoutGrid, List, Plus, RotateCcw, Search } from 'lucide-react';
import {
  ApiError,
  getListRsvpsQueryKey,
  useAssignRsvpTable,
  useListRsvps,
  type ChoiceOption,
  type Rsvp,
} from '@workspace/api-client-react';
import { optionLabel } from '@/components/rsvp-parts';
import { matchesSearch } from '@/lib/rsvp-search';

export const MAX_TABLES = 50;
const TABLE_STEP = 1;

type Props = {
  tabs: React.ReactNode;
  onSignedOut: () => void;
  teamLabel: string;
  eventTitle: string;
  deptOptions: ChoiceOption[];
  tableCount: number;
  onChangeTableCount: (next: number) => void;
};

function familyName(rsvp: Rsvp) {
  return [rsvp.fatherName, rsvp.motherName].filter(Boolean).join(' · ') || rsvp.name || '이름 없음';
}

// Seating cares about where a family belongs, not how many of them there are.
function belonging(rsvp: Rsvp, deptOptions: ChoiceOption[]) {
  return [optionLabel(deptOptions, rsvp.belongDept), rsvp.belongTeam ?? ''].filter(Boolean).join(' · ');
}

export function AdminTables({ tabs, onSignedOut, teamLabel, eventTitle, deptOptions, tableCount, onChangeTableCount }: Props) {
  const queryClient = useQueryClient();
  const rsvpsQuery = useListRsvps({ query: { queryKey: getListRsvpsQueryKey(), retry: false } });
  const assignTable = useAssignRsvpTable();
  const [query, setQuery] = useState('');
  // Clicking a card or a table chip narrows the list below; 전체 보기 clears it.
  const [filter, setFilter] = useState<{ kind: 'all' | 'assigned' | 'unassigned' } | { kind: 'table'; table: number }>({ kind: 'all' });
  // 'list' prints one section per table, 'board' prints the seating chart as it looks on screen.
  const [printing, setPrinting] = useState<'list' | 'board' | null>(null);
  const [dragging, setDragging] = useState<Rsvp | null>(null);
  const [dropTarget, setDropTarget] = useState<number | 'none' | null>(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    if (rsvpsQuery.error instanceof ApiError && rsvpsQuery.error.status === 401) onSignedOut();
  }, [rsvpsQuery.error, onSignedOut]);

  // Printing always covers every table, whatever the filter and search hold.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener('afterprint', done, { once: true });
    window.print();
    // Safety net for browsers that never fire afterprint, so the view cannot stay stuck in print mode.
    const timer = window.setTimeout(done, 1000);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const rsvps = rsvpsQuery.data ?? [];

  // Seats are counted for adults only; children share their parents' table.
  const summary = useMemo(() => {
    const adultsByTable = new Map<number, number>();
    let unassignedAdults = 0;
    let unassignedFamilies = 0;
    for (const rsvp of rsvps) {
      if (rsvp.tableNumber == null) {
        unassignedAdults += rsvp.adultCount;
        unassignedFamilies += 1;
        continue;
      }
      adultsByTable.set(rsvp.tableNumber, (adultsByTable.get(rsvp.tableNumber) ?? 0) + rsvp.adultCount);
    }
    const used = [...adultsByTable.entries()].sort(([a], [b]) => a - b);
    return { used, unassignedAdults, unassignedFamilies, seatedAdults: used.reduce((sum, [, adults]) => sum + adults, 0) };
  }, [rsvps]);

  const rows = useMemo(() => {
    if (printing) return rsvps;
    const matchesFilter = (rsvp: Rsvp) => {
      if (filter.kind === 'assigned') return rsvp.tableNumber != null;
      if (filter.kind === 'unassigned') return rsvp.tableNumber == null;
      if (filter.kind === 'table') return rsvp.tableNumber === filter.table;
      return true;
    };
    return rsvps.filter((rsvp) => matchesFilter(rsvp) && (!query.trim() || matchesSearch(rsvp, query, optionLabel(deptOptions, rsvp.belongDept))));
  }, [rsvps, query, deptOptions, filter, printing]);

  // Empty tables are shown too, so a family can be dropped onto one that nobody sits at yet.
  const visibleTables = useMemo(() => {
    const highestAssigned = rsvps.reduce((highest, rsvp) => Math.max(highest, rsvp.tableNumber ?? 0), 0);
    return Math.min(MAX_TABLES, Math.max(tableCount, highestAssigned));
  }, [rsvps, tableCount]);

  const board = useMemo(() => {
    const byTable = new Map<number, Rsvp[]>();
    const unassigned: Rsvp[] = [];
    for (const rsvp of rows) {
      if (rsvp.tableNumber == null) {
        unassigned.push(rsvp);
        continue;
      }
      byTable.set(rsvp.tableNumber, [...(byTable.get(rsvp.tableNumber) ?? []), rsvp]);
    }
    const numbers = filter.kind === 'table' && !printing ? [filter.table] : Array.from({ length: visibleTables }, (_, index) => index + 1);
    const tables = numbers.map((table) => {
      const families = byTable.get(table) ?? [];
      return { table, families, adults: families.reduce((sum, rsvp) => sum + rsvp.adultCount, 0) };
    });
    return { tables, unassigned };
  }, [rows, visibleTables, filter, printing]);

  const filterLabel =
    filter.kind === 'assigned' ? '배정된 가족만' : filter.kind === 'unassigned' ? '미배정 가족만' : filter.kind === 'table' ? `${filter.table}번 테이블만` : '';

  // The dragged family is read back from the drag data, so a fast drop never uses a stale value.
  function dropped(event: React.DragEvent, tableNumber: number | null) {
    event.preventDefault();
    setDropTarget(null);
    const id = Number(event.dataTransfer.getData('text/plain'));
    const rsvp = rsvps.find((row) => row.id === id) ?? dragging;
    if (rsvp) assign(rsvp, tableNumber);
  }

  function assign(rsvp: Rsvp, tableNumber: number | null) {
    if (rsvp.tableNumber === tableNumber) return;
    setError('');
    setSavingId(rsvp.id);
    assignTable.mutate(
      { id: rsvp.id, data: { tableNumber } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListRsvpsQueryKey() });
        },
        onError: (assignError) => {
          if (assignError instanceof ApiError && assignError.status === 401) return onSignedOut();
          setError('테이블을 배정하지 못했어요. 잠시 후 다시 시도해 주세요.');
        },
        onSettled: () => setSavingId(null),
      },
    );
  }

  return (
    <div className={`reservations ${printing ? `printing-${printing}` : ''}`}>
      <div className="tabs-row">{tabs}</div>

      <section className="stats admin-stats no-print" data-testid="table-summary-totals">
        <button type="button" className={`stat stat-button ${filter.kind === 'assigned' ? 'on' : ''}`} aria-pressed={filter.kind === 'assigned'} onClick={() => setFilter({ kind: 'assigned' })} data-testid="button-filter-assigned">
          <div className="stat-label">배정된 어른</div>
          <div className="stat-value" data-testid="text-seated-adults">{summary.seatedAdults}<small>명</small></div>
        </button>
        <button type="button" className={`stat stat-button highlight ${filter.kind === 'assigned' ? 'on' : ''}`} aria-pressed={filter.kind === 'assigned'} onClick={() => setFilter({ kind: 'assigned' })} data-testid="button-filter-tables-used">
          <div className="stat-label">사용 중인 테이블</div>
          <div className="stat-value" data-testid="text-tables-used">{summary.used.length}<small>/{MAX_TABLES}</small></div>
        </button>
        <button type="button" className={`stat stat-button ${filter.kind === 'unassigned' ? 'on' : ''}`} aria-pressed={filter.kind === 'unassigned'} onClick={() => setFilter({ kind: 'unassigned' })} data-testid="button-filter-unassigned">
          <div className="stat-label">미배정</div>
          <div className="stat-value" data-testid="text-unassigned">{summary.unassignedAdults}<small>명 · {summary.unassignedFamilies}가족</small></div>
        </button>
      </section>

      <div className="table-chips no-print" data-testid="list-table-counts">
        <button type="button" className={`table-chip ${filter.kind === 'all' ? 'on' : ''}`} aria-pressed={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })} data-testid="button-filter-all"><RotateCcw size={14} /> 전체 보기</button>
        {summary.used.length === 0 ? (
          <span className="admin-muted">아직 배정된 테이블이 없어요.</span>
        ) : (
          summary.used.map(([table, adults]) => (
            <button
              type="button"
              className={`table-chip ${filter.kind === 'table' && filter.table === table ? 'on' : ''}`}
              aria-pressed={filter.kind === 'table' && filter.table === table}
              key={table}
              onClick={() => setFilter({ kind: 'table', table })}
              data-testid={`chip-table-${table}`}
            >
              <strong>{table}번</strong> 어른 {adults}명
            </button>
          ))
        )}
      </div>

      {filterLabel && (
        <p className="admin-muted no-print" data-testid="text-table-filter">
          {filterLabel} · {rows.length}가족 표시 중
          <button type="button" className="link-button filter-clear" onClick={() => setFilter({ kind: 'all' })} data-testid="button-clear-filter">필터 해제</button>
        </p>
      )}

      <label className="search-box no-print">
        <Search size={18} />
        <span className="sr-only">검색</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`이름, 자녀 이름, 연락처 뒷자리, ${teamLabel} 검색`} data-testid="input-table-search" />
      </label>

      {error && <p className="error no-print" role="alert" data-testid="status-table-error">{error}</p>}

      <div className="board-toolbar no-print">
        <span className="admin-muted">가족 카드를 원하는 테이블로 끌어다 놓으면 배정돼요.</span>
        <div className="board-toolbar-actions">
          <button type="button" className="btn btn-outline btn-small" onClick={() => setPrinting('list')} data-testid="button-print-table-list"><List size={16} /> 목록으로 인쇄</button>
          <button type="button" className="btn btn-outline btn-small" onClick={() => setPrinting('board')} data-testid="button-print-table-board"><LayoutGrid size={16} /> 배치도로 인쇄</button>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-small"
          disabled={visibleTables >= MAX_TABLES}
          onClick={() => onChangeTableCount(Math.min(MAX_TABLES, visibleTables + TABLE_STEP))}
          data-testid="button-add-tables"
        >
          <Plus size={16} /> 테이블 추가 <em className="admin-muted">(현재 {visibleTables}개)</em>
        </button>
      </div>

      <header className="print-only print-header">
        <h1>{eventTitle} 테이블 배정표</h1>
        <p>테이블 {visibleTables}개 · 배정 {summary.seatedAdults}명(어른) · 미배정 {summary.unassignedFamilies}가족 · 출력 {new Date().toLocaleDateString('ko-KR')}</p>
      </header>

      <div className="print-only print-table-list" data-testid="print-table-list">
        {board.tables.map(({ table, families, adults }) => (
          <section className="print-table" key={table}>
            <h2>{table}번 <small>어른 {adults}명 · {families.length}가족</small></h2>
            {families.length === 0 ? (
              <p className="print-table-empty">배정된 가족 없음</p>
            ) : (
              <ol>
                {families.map((rsvp) => (
                  <li key={rsvp.id}>
                    {familyName(rsvp)}
                    <span className="print-note">어른 {rsvp.adultCount}{rsvp.childCount > 0 && ` · 자녀 ${rsvp.childCount}`}{belonging(rsvp, deptOptions) && ` · ${belonging(rsvp, deptOptions)}`}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
        {board.unassigned.length > 0 && (
          <section className="print-table">
            <h2>미배정 <small>{board.unassigned.length}가족</small></h2>
            <ol>
              {board.unassigned.map((rsvp) => (
                <li key={rsvp.id}>
                  {familyName(rsvp)}
                  <span className="print-note">어른 {rsvp.adultCount}{rsvp.childCount > 0 && ` · 자녀 ${rsvp.childCount}`}{belonging(rsvp, deptOptions) && ` · ${belonging(rsvp, deptOptions)}`}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <section
        className={`table-box unassigned-pool ${dropTarget === 'none' ? 'drop-over' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setDropTarget('none'); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget('none'); }}
        onDragLeave={() => setDropTarget((current) => (current === 'none' ? null : current))}
        onDrop={(e) => dropped(e, null)}
        data-testid="box-table-unassigned"
      >
        <header className="table-box-head">
          <strong>미배정</strong>
          <span>{board.unassigned.length}가족</span>
        </header>
        <ul className="table-box-list">
          {board.unassigned.length === 0 ? (
            <li className="table-box-empty">모두 배정됐어요</li>
          ) : (
            board.unassigned.map((rsvp) => (
              <li
                key={rsvp.id}
                className={`table-box-family ${dragging?.id === rsvp.id ? 'dragging' : ''}`}
                draggable={savingId !== rsvp.id}
                onDragStart={(e) => { setDragging(rsvp); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(rsvp.id)); }}
                onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                data-testid={`card-family-${rsvp.id}`}
              >
                <GripVertical className="grip" size={14} />
                <span>
                  <span className="table-box-name">{familyName(rsvp)}</span>
                  {belonging(rsvp, deptOptions) && <span className="table-box-count">{belonging(rsvp, deptOptions)}</span>}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <div className="table-board" data-testid="board-tables">

        {board.tables.map(({ table, families, adults }) => (
          <article
            className={`table-box ${dropTarget === table ? 'drop-over' : ''} ${families.length === 0 ? 'empty' : ''}`}
            key={table}
            onDragEnter={(e) => { e.preventDefault(); setDropTarget(table); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(table); }}
            onDragLeave={() => setDropTarget((current) => (current === table ? null : current))}
            onDrop={(e) => dropped(e, table)}
            data-testid={`box-table-${table}`}
          >
            <header className="table-box-head">
              <strong>{table}번</strong>
              <span>어른 {adults}명</span>
            </header>
            <ul className="table-box-list">
              {families.length === 0 ? (
                <li className="table-box-empty">여기로 끌어다 놓기</li>
              ) : (
                families.map((rsvp) => (
                  <li
                    key={rsvp.id}
                    className={`table-box-family ${dragging?.id === rsvp.id ? 'dragging' : ''}`}
                    draggable={savingId !== rsvp.id}
                    onDragStart={(e) => { setDragging(rsvp); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(rsvp.id)); }}
                    onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                    data-testid={`card-family-${rsvp.id}`}
                  >
                    <GripVertical className="grip" size={14} />
                    <span>
                      <span className="table-box-name">{familyName(rsvp)}</span>
                      {belonging(rsvp, deptOptions) && <span className="table-box-count">{belonging(rsvp, deptOptions)}</span>}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
