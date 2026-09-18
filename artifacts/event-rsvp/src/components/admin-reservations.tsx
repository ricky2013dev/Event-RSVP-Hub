import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import {
  ApiError,
  getGetRsvpSummaryQueryKey,
  getListRsvpsQueryKey,
  useAssignRsvpTable,
  useDeleteRsvp,
  useListRsvps,
  type ChoiceOption,
  type Rsvp,
} from '@workspace/api-client-react';
import { AdminRsvpEditor } from '@/components/admin-rsvp-editor';
import { optionLabel, shortHeader } from '@/components/rsvp-parts';
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

function downloadCsv(rsvps: Rsvp[], labels: { eventTitle: string; teamLabel: string; deptLabel: string; deptOptions: ChoiceOption[]; messageLabel: string }) {
  const header = ['가족', '아빠', '엄마', '자녀', '어른 수', '자녀 수', '총 인원', '연락처', labels.deptLabel, labels.teamLabel, '테이블', labels.messageLabel, '등록 일시'];
  const lines = rsvps.map((rsvp, index) => [
    `가족 ${index + 1}`,
    rsvp.fatherName,
    rsvp.motherName,
    rsvp.children.map((child) => `${child.name}(${child.age}살)`).join(', '),
    rsvp.adultCount,
    rsvp.childCount,
    rsvp.guestCount,
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

type Props = {
  tabs: React.ReactNode;
  onSignedOut: () => void;
  eventTitle: string;
  teamLabel: string;
  deptLabel: string;
  deptOptions: ChoiceOption[];
  tableCount: number;
  messageLabel: string;
};

export function AdminReservations({ tabs, onSignedOut, eventTitle, teamLabel, deptLabel, deptOptions, tableCount, messageLabel }: Props) {
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

  const rows = useMemo(() => {
    const numbered = rsvps.map((rsvp, index) => ({ rsvp, number: index + 1 }));
    if (!query.trim() || printing) return numbered;
    return numbered.filter(({ rsvp }) => matchesSearch(rsvp, query, optionLabel(deptOptions, rsvp.belongDept)));
  }, [rsvps, query, printing, deptOptions]);

  return (
    <div className="reservations">
      <div className="tabs-row">
        {tabs}
        <div className="toolbar">
          <button className="btn btn-outline btn-small toolbar-add" type="button" onClick={() => { setRowError(''); setEditor({ rsvp: null }); }} data-testid="button-add-rsvp"><Plus size={18} /> 가족 추가</button>
          <button className="btn btn-outline icon-btn" type="button" title="CSV로 내보내기" aria-label="CSV로 내보내기" disabled={rsvps.length === 0} onClick={() => downloadCsv(rsvps, { eventTitle, teamLabel, deptLabel, deptOptions, messageLabel })} data-testid="button-export-csv"><Download size={18} /></button>
          <button className="btn btn-outline btn-small toolbar-print" type="button" disabled={rsvps.length === 0} onClick={() => setPrinting(true)} data-testid="button-print"><Printer size={18} /> 명단 · 메시지 인쇄</button>
        </div>
      </div>

      <header className="print-only print-header">
        <h1>{eventTitle} 참석 명단</h1>
        <p>등록 {totals.families}가족 · 총 {totals.adults + totals.children}명 (어른 {totals.adults} / 자녀 {totals.children}) · 출력 {dateFormat.format(new Date())}</p>
      </header>

      <section className="stats admin-stats no-print" data-testid="admin-summary">
        <div className="stat"><div className="stat-label">등록 가족</div><div className="stat-value" data-testid="text-admin-families">{totals.families}<small>가족</small></div></div>
        <div className="stat highlight"><div className="stat-label">총 참석 예정 인원</div><div className="stat-value" data-testid="text-admin-total">{totals.adults + totals.children}<small>명</small></div></div>
        <div className="stat"><div className="stat-label">어른 / 자녀</div><div className="stat-value" data-testid="text-admin-adults-children">{totals.adults} / {totals.children}<small>명</small></div></div>
      </section>

      <label className="search-box no-print">
        <Search size={18} />
        <span className="sr-only">검색</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`이름, 자녀 이름, 연락처 뒷자리, ${teamLabel} 검색`} data-testid="input-admin-search" />
      </label>

      <div className="table-wrap">
        <table className="rsvp-table" data-testid="table-rsvps">
          <thead>
            <tr>
              <th>가족</th>
              <th>아빠</th>
              <th>엄마</th>
              <th>자녀</th>
              <th>테이블</th>
              <th title={`${deptLabel} · ${teamLabel}`}>{shortHeader(deptLabel)} · {shortHeader(teamLabel)}</th>
              <th className="num">자녀 수</th>
              <th className="num">총 인원</th>
              <th>연락처</th>
              <th>등록 일시</th>
              <th className="col-actions no-print">관리</th>
            </tr>
          </thead>
          <tbody>
            {rsvpsQuery.isLoading ? (
              <tr><td colSpan={11} className="table-empty">불러오는 중…</td></tr>
            ) : rsvpsQuery.isError ? (
              <tr><td colSpan={11} className="table-empty">목록을 불러오지 못했어요. <button type="button" className="link-button" onClick={() => void rsvpsQuery.refetch()}>다시 시도</button></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} className="table-empty">
                {query ? '검색 결과가 없어요.' : (
                  <>아직 RSVP가 없어요. <button type="button" className="link-button" onClick={() => { setRowError(''); setEditor({ rsvp: null }); }} data-testid="button-add-rsvp-empty">가족 직접 추가</button></>
                )}
              </td></tr>
            ) : (
              rows.map(({ rsvp, number }) => (
                <tr key={rsvp.id} data-testid={`row-rsvp-${rsvp.id}`}>
                  <td className="muted-cell nowrap">{number}</td>
                  <td>{rsvp.fatherName || '—'}</td>
                  <td>{rsvp.motherName || '—'}</td>
                  <td className="children-cell">
                    {rsvp.children.length ? rsvp.children.map((child) => child.name).join(', ') : '—'}
                    {rsvp.message && <div className="row-message">“{rsvp.message}”</div>}
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
                  <td className="num">{rsvp.childCount}</td>
                  <td className="num strong">{rsvp.guestCount}</td>
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
      {query && !printing && rows.length > 0 && <p className="admin-muted no-print">{rows.length}건 표시 중 · 전체 {rsvps.length}가족</p>}
      {editor && (
        <AdminRsvpEditor
          key={editor.rsvp?.id ?? 'new'}
          rsvp={editor.rsvp}
          labels={{ teamLabel, deptLabel, deptOptions, messageLabel }}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); refreshLists(); }}
          onSignedOut={onSignedOut}
        />
      )}
    </div>
  );
}
