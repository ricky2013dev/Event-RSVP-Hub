import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import {
  ApiError,
  getGetRsvpSummaryQueryKey,
  getListRsvpsQueryKey,
  useAssignRsvpTable,
  useDeleteRsvp,
  useListRsvps,
  type ChildGroup,
  type ChoiceOption,
  type Rsvp,
} from '@workspace/api-client-react';
import { AdminRsvpEditor } from '@/components/admin-rsvp-editor';
import { optionLabel, shortHeader } from '@/components/rsvp-parts';
import { childDetail } from '@/lib/child-groups';
import { matchesSearch } from '@/lib/rsvp-search';

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

// Quote every cell; a leading = + - @ would run as a formula in Excel, so neutralise it.
function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function childText(child: Rsvp['children'][number]) {
  const detail = childDetail(child, (age) => `${age}살`);
  return detail ? `${child.name}(${detail})` : child.name;
}

// How many of one family's children are in the named group.
function groupCount(rsvp: Rsvp, group: ChildGroup) {
  return rsvp.children.filter((child) => child.group === group.name).length;
}

function downloadCsv(rsvps: Rsvp[], labels: { isFamilyType: boolean; childGroups: ChildGroup[]; eventTitle: string; teamLabel: string; deptLabel: string; deptOptions: ChoiceOption[]; messageLabel: string }) {
  const header = labels.isFamilyType
    ? ['가족', '아빠', '엄마', '자녀', '어른 수', '자녀 수', ...labels.childGroups.map((group) => group.name), '총 인원', '연락처', labels.deptLabel, labels.teamLabel, '테이블', labels.messageLabel, '등록 일시']
    : ['번호', '이름', '연락처', labels.deptLabel, labels.teamLabel, '테이블', labels.messageLabel, '등록 일시'];
  const lines = rsvps.map((rsvp, index) => [
    labels.isFamilyType ? `가족 ${index + 1}` : index + 1,
    rsvp.fatherName,
    ...(labels.isFamilyType
      ? [
          rsvp.motherName,
          rsvp.children.map((child) => childText(child)).join(', '),
          rsvp.adultCount,
          rsvp.childCount,
          ...labels.childGroups.map((group) => groupCount(rsvp, group)),
          rsvp.guestCount,
        ]
      : []),
    rsvp.phoneNumber ?? '',
    optionLabel(labels.deptOptions, rsvp.belongDept),
    rsvp.belongTeam ?? '',
    rsvp.tableNumber ?? '',
    rsvp.message ?? '',
    dateFormat.format(new Date(rsvp.createdAt)),
  ]);
  const csv = [header, ...lines].map((row) => row.map(csvCell).join(',')).join('\r\n');
  // The BOM makes Excel open the file as UTF-8 so Korean text is not garbled.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  link.href = url;
  link.download = `${labels.eventTitle.replace(/[\\/:*?"<>|]/g, '').trim() || 'rsvp'}-RSVP-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// A column is sorted by its key; a group column's key is `group:` plus the group's name.
type Sort = { key: string; dir: 'asc' | 'desc' } | null;
type SortValue = string | number | null;

const collator = new Intl.Collator('ko', { numeric: true });

// Empty cells stay at the bottom whichever way the column is sorted.
function compareSortValues(a: SortValue, b: SortValue, dir: 'asc' | 'desc') {
  const aEmpty = a === null || a === '';
  const bEmpty = b === null || b === '';
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  const order = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
  return dir === 'asc' ? order : -order;
}

function SortHeader({ label, sortKey, sort, onSort, className, title }: { label: React.ReactNode; sortKey: string; sort: Sort; onSort: (key: string) => void; className?: string; title?: string }) {
  const dir = sort?.key === sortKey ? sort.dir : null;
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <th className={className} title={title} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}>
      <button type="button" className="sort-button" data-active={dir ? '' : undefined} onClick={() => onSort(sortKey)} data-testid={`sort-${sortKey}`}>
        {label}<Icon size={13} className="no-print" />
      </button>
    </th>
  );
}

type Props = {
  tabs: React.ReactNode;
  onSignedOut: () => void;
  isFamilyType: boolean;
  eventTitle: string;
  teamLabel: string;
  deptLabel: string;
  deptOptions: ChoiceOption[];
  tableCount: number;
  messageLabel: string;
  childGroups: ChildGroup[];
};

export function AdminReservations({ tabs, onSignedOut, isFamilyType, eventTitle, teamLabel, deptLabel, deptOptions, tableCount, messageLabel, childGroups }: Props) {
  const queryClient = useQueryClient();
  const rsvpsQuery = useListRsvps({ query: { queryKey: getListRsvpsQueryKey(), retry: false } });
  const deleteRsvp = useDeleteRsvp();
  const assignTable = useAssignRsvpTable();
  const [query, setQuery] = useState('');
  const [printing, setPrinting] = useState(false);
  // null keeps the editor closed; { rsvp: null } opens it empty to add a family by hand.
  const [editor, setEditor] = useState<{ rsvp: Rsvp | null } | null>(null);
  // Deleting is confirmed in the row itself, so no browser dialog interrupts the dashboard.
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [rowError, setRowError] = useState('');
  const [sort, setSort] = useState<Sort>(null);

  // Each click on a header steps through ascending, descending, then back to sign-up order.
  function toggleSort(key: string) {
    setSort((current) => (current?.key !== key ? { key, dir: 'asc' } : current.dir === 'asc' ? { key, dir: 'desc' } : null));
  }

  function refreshLists() {
    void queryClient.invalidateQueries({ queryKey: getListRsvpsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetRsvpSummaryQueryKey() });
  }

  // Seating is assigned right here as well as on the board, so both tabs stay in step.
  function assign(rsvp: Rsvp, value: string) {
    setRowError('');
    assignTable.mutate(
      { id: rsvp.id, data: { tableNumber: value ? Number(value) : null } },
      {
        onSuccess: refreshLists,
        onError: (assignError) => {
          if (assignError instanceof ApiError && assignError.status === 401) return onSignedOut();
          setRowError('테이블을 배정하지 못했어요. 잠시 후 다시 시도해 주세요.');
        },
      },
    );
  }

  function remove(id: number) {
    setRowError('');
    deleteRsvp.mutate(
      { id },
      {
        onSuccess: () => {
          setConfirmingDelete(null);
          refreshLists();
        },
        onError: (deleteError) => {
          if (deleteError instanceof ApiError && deleteError.status === 401) return onSignedOut();
          setRowError('삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
        },
      },
    );
  }

  // Print always covers the full list, whatever the search box holds.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    window.print();
    return () => window.removeEventListener('afterprint', done);
  }, [printing]);

  useEffect(() => {
    if (rsvpsQuery.error instanceof ApiError && rsvpsQuery.error.status === 401) onSignedOut();
  }, [rsvpsQuery.error, onSignedOut]);

  // Newest first; "가족 N" follows this order like the reference dashboard.
  const rsvps = rsvpsQuery.data ?? [];
  const totals = useMemo(
    () => ({
      families: rsvps.length,
      adults: rsvps.reduce((sum, rsvp) => sum + rsvp.adultCount, 0),
      children: rsvps.reduce((sum, rsvp) => sum + rsvp.childCount, 0),
    }),
    [rsvps],
  );

  // Head counts per group, so each group's room can be staffed. Children saved before groups
  // existed, or under a group since renamed, are counted apart rather than dropped.
  const groupCounts = useMemo(() => {
    const kids = rsvps.flatMap((rsvp) => rsvp.children);
    const groups = childGroups.map((group) => ({ group, count: kids.filter((child) => child.group === group.name).length }));
    const other = kids.length - groups.reduce((sum, { count }) => sum + count, 0);
    return { groups, other };
  }, [rsvps, childGroups]);

  // 엄마, 자녀 수, the group columns and 총 인원 are dropped outside a family event, so the empty rows span fewer columns.
  const columnCount = isFamilyType ? 11 + childGroups.length : 8;

  const rows = useMemo(() => {
    const numbered = rsvps.map((rsvp, index) => ({ rsvp, number: index + 1 }));
    const filtered = !query.trim() || printing
      ? numbered
      : numbered.filter(({ rsvp }) => matchesSearch(rsvp, query, optionLabel(deptOptions, rsvp.belongDept)));
    if (!sort) return filtered;

    const valueOf = ({ rsvp, number }: { rsvp: Rsvp; number: number }): SortValue => {
      if (sort.key.startsWith('group:')) {
        const name = sort.key.slice('group:'.length);
        return rsvp.children.filter((child) => child.group === name).length;
      }
      switch (sort.key) {
        case 'number': return number;
        case 'father': return rsvp.fatherName || null;
        case 'mother': return rsvp.motherName || null;
        case 'children': return isFamilyType ? rsvp.children.map((child) => child.name).join(', ') : rsvp.message ?? null;
        case 'table': return rsvp.tableNumber ?? null;
        case 'dept': return [optionLabel(deptOptions, rsvp.belongDept), rsvp.belongTeam].filter(Boolean).join(' ');
        case 'childCount': return rsvp.childCount;
        case 'guestCount': return rsvp.guestCount;
        case 'phone': return rsvp.phoneNumber || null;
        case 'createdAt': return new Date(rsvp.createdAt).getTime();
        default: return null;
      }
    };
    // Ties keep sign-up order.
    return [...filtered].sort((a, b) => compareSortValues(valueOf(a), valueOf(b), sort.dir) || a.number - b.number);
  }, [rsvps, query, printing, deptOptions, sort, isFamilyType]);

  return (
    <div className="reservations">
      <div className="tabs-row">
        {tabs}
        <div className="toolbar">
          <button className="btn btn-outline btn-small toolbar-add" type="button" onClick={() => { setRowError(''); setEditor({ rsvp: null }); }} data-testid="button-add-rsvp"><Plus size={18} /> {isFamilyType ? '가족 추가' : '참석자 추가'}</button>
          <button className="btn btn-outline icon-btn" type="button" title="CSV로 내보내기" aria-label="CSV로 내보내기" disabled={rsvps.length === 0} onClick={() => downloadCsv(rsvps, { isFamilyType, childGroups, eventTitle, teamLabel, deptLabel, deptOptions, messageLabel })} data-testid="button-export-csv"><Download size={18} /></button>
          <button className="btn btn-outline btn-small toolbar-print" type="button" disabled={rsvps.length === 0} onClick={() => setPrinting(true)} data-testid="button-print"><Printer size={18} /> 명단 · 메시지 인쇄</button>
        </div>
      </div>

      <header className="print-only print-header">
        <h1>{eventTitle} 참석 명단</h1>
        <p>
          {isFamilyType
            ? `등록 ${totals.families}가족 · 총 ${totals.adults + totals.children}명 (어른 ${totals.adults} / 자녀 ${totals.children})`
            : `총 ${totals.adults}명`} · 출력 {dateFormat.format(new Date())}
        </p>
      </header>

      {/* Outside a family event every reply is one adult, so the head count is the only figure worth showing. */}
      <section className={`stats admin-stats no-print ${isFamilyType ? '' : 'solo'}`} data-testid="admin-summary">
        {isFamilyType && <div className="stat"><div className="stat-label">등록 가족</div><div className="stat-value" data-testid="text-admin-families">{totals.families}<small>가족</small></div></div>}
        <div className="stat highlight"><div className="stat-label">총 참석 예정 인원</div><div className="stat-value" data-testid="text-admin-total">{totals.adults + totals.children}<small>명</small></div></div>
        {isFamilyType && <div className="stat"><div className="stat-label">어른 / 자녀</div><div className="stat-value" data-testid="text-admin-adults-children">{totals.adults} / {totals.children}<small>명</small></div></div>}
      </section>
      {isFamilyType && groupCounts.groups.length > 0 && (
        <section className="stats admin-stats admin-group-stats no-print" data-testid="admin-child-groups">
          {groupCounts.groups.map(({ group, count }, index) => (
            <div className="stat" key={group.name}><div className="stat-label">{group.name}</div><div className="stat-value" data-testid={`text-admin-group-${index}`}>{count}<small>명</small></div></div>
          ))}
          {groupCounts.other > 0 && <div className="stat"><div className="stat-label">그룹 없음</div><div className="stat-value" data-testid="text-admin-group-other">{groupCounts.other}<small>명</small></div></div>}
        </section>
      )}

      <label className="search-box no-print">
        <Search size={18} />
        <span className="sr-only">검색</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`이름, ${isFamilyType ? '자녀 이름, ' : ''}연락처 뒷자리, ${teamLabel} 검색`} data-testid="input-admin-search" />
      </label>

      <div className="table-wrap">
        <table className="rsvp-table" data-testid="table-rsvps">
          <thead>
            <tr>
              <SortHeader label={isFamilyType ? '가족' : '번호'} sortKey="number" sort={sort} onSort={toggleSort} />
              <SortHeader label={isFamilyType ? '아빠' : '이름'} sortKey="father" sort={sort} onSort={toggleSort} />
              {isFamilyType && <SortHeader label="엄마" sortKey="mother" sort={sort} onSort={toggleSort} />}
              <SortHeader label={isFamilyType ? '자녀' : messageLabel} sortKey="children" sort={sort} onSort={toggleSort} />
              <SortHeader label="테이블" sortKey="table" sort={sort} onSort={toggleSort} />
              <SortHeader label={<>{shortHeader(deptLabel)} · {shortHeader(teamLabel)}</>} title={`${deptLabel} · ${teamLabel}`} sortKey="dept" sort={sort} onSort={toggleSort} />
              {isFamilyType && <SortHeader label="자녀 수" className="num" sortKey="childCount" sort={sort} onSort={toggleSort} />}
              {isFamilyType && childGroups.map((group) => <SortHeader key={group.name} label={group.name} className="num nowrap" sortKey={`group:${group.name}`} sort={sort} onSort={toggleSort} />)}
              {isFamilyType && <SortHeader label="총 인원" className="num" sortKey="guestCount" sort={sort} onSort={toggleSort} />}
              <SortHeader label="연락처" sortKey="phone" sort={sort} onSort={toggleSort} />
              <SortHeader label="등록 일시" sortKey="createdAt" sort={sort} onSort={toggleSort} />
              <th className="col-actions no-print">관리</th>
            </tr>
          </thead>
          <tbody>
            {rsvpsQuery.isLoading ? (
              <tr><td colSpan={columnCount} className="table-empty">불러오는 중…</td></tr>
            ) : rsvpsQuery.isError ? (
              <tr><td colSpan={columnCount} className="table-empty">목록을 불러오지 못했어요. <button type="button" className="link-button" onClick={() => void rsvpsQuery.refetch()}>다시 시도</button></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columnCount} className="table-empty">
                {query ? '검색 결과가 없어요.' : (
                  <>아직 RSVP가 없어요. <button type="button" className="link-button" onClick={() => { setRowError(''); setEditor({ rsvp: null }); }} data-testid="button-add-rsvp-empty">{isFamilyType ? '가족 직접 추가' : '참석자 직접 추가'}</button></>
                )}
              </td></tr>
            ) : (
              rows.map(({ rsvp, number }) => (
                <tr key={rsvp.id} data-testid={`row-rsvp-${rsvp.id}`}>
                  <td className="muted-cell nowrap">{number}</td>
                  <td>{rsvp.fatherName || '—'}</td>
                  {isFamilyType && <td>{rsvp.motherName || '—'}</td>}
                  <td className="children-cell">
                    {isFamilyType && (rsvp.children.length ? rsvp.children.map((child) => childText(child)).join(', ') : '—')}
                    {rsvp.message && <div className="row-message">“{rsvp.message}”</div>}
                    {!isFamilyType && !rsvp.message && '—'}
                  </td>
                  <td className="nowrap">
                    <select
                      className="table-select no-print"
                      value={rsvp.tableNumber ?? ''}
                      onChange={(e) => assign(rsvp, e.target.value)}
                      aria-label={`${rsvp.name || '가족'} 테이블`}
                      data-testid={`select-table-${rsvp.id}`}
                    >
                      <option value="">미배정</option>
                      {Array.from({ length: Math.max(tableCount, rsvp.tableNumber ?? 0) }, (_, index) => index + 1).map((table) => (
                        <option value={table} key={table}>{table}번</option>
                      ))}
                    </select>
                    <span className="print-only">{rsvp.tableNumber ? `${rsvp.tableNumber}번` : '—'}</span>
                  </td>
                  <td>
                    {rsvp.belongDept || rsvp.belongTeam ? (
                      <>
                        {optionLabel(deptOptions, rsvp.belongDept) || '—'}
                        {rsvp.belongTeam && <div className="row-message">{rsvp.belongTeam}</div>}
                      </>
                    ) : '—'}
                  </td>
                  {isFamilyType && <td className="num">{rsvp.childCount}</td>}
                  {isFamilyType && childGroups.map((group) => <td className="num" key={group.name}>{groupCount(rsvp, group)}</td>)}
                  {isFamilyType && <td className="num strong">{rsvp.guestCount}</td>}
                  <td className="nowrap">{rsvp.phoneNumber || '—'}</td>
                  <td className="muted-cell nowrap">{dateFormat.format(new Date(rsvp.createdAt))}</td>
                  <td className="row-actions no-print">
                    {confirmingDelete === rsvp.id ? (
                      <>
                        <span className="admin-muted">삭제할까요?</span>
                        <button type="button" className="remove" disabled={deleteRsvp.isPending} onClick={() => remove(rsvp.id)} data-testid={`button-confirm-delete-${rsvp.id}`}>{deleteRsvp.isPending ? '삭제 중…' : '삭제'}</button>
                        <button type="button" className="link-button" onClick={() => setConfirmingDelete(null)} data-testid={`button-cancel-delete-${rsvp.id}`}>취소</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="link-button" onClick={() => { setRowError(''); setEditor({ rsvp }); }} data-testid={`button-edit-${rsvp.id}`}><Pencil size={14} /> 수정</button>
                        <button type="button" className="remove" onClick={() => { setRowError(''); setConfirmingDelete(rsvp.id); }} data-testid={`button-delete-${rsvp.id}`}><Trash2 size={14} /> 삭제</button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rowError && <p className="error no-print" role="alert" data-testid="status-row-error">{rowError}</p>}
      {query && !printing && rows.length > 0 && <p className="admin-muted no-print">{rows.length}건 표시 중 · 전체 {rsvps.length}{isFamilyType ? '가족' : '명'}</p>}
      {editor && (
        <AdminRsvpEditor
          key={editor.rsvp?.id ?? 'new'}
          rsvp={editor.rsvp}
          labels={{ isFamilyType, teamLabel, deptLabel, deptOptions, messageLabel, childGroups }}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); refreshLists(); }}
          onSignedOut={onSignedOut}
        />
      )}
    </div>
  );
}
