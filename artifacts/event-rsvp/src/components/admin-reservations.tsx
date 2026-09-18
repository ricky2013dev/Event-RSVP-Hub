import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import { ApiError, getListRsvpsQueryKey, useListRsvps, type Rsvp } from '@workspace/api-client-react';

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

function downloadCsv(rsvps: Rsvp[], labels: { eventTitle: string; teamLabel: string; messageLabel: string }) {
  const header = ['가족', '아빠', '엄마', '자녀', '어른 수', '자녀 수', '총 인원', '연락처', labels.teamLabel, labels.messageLabel, '등록 일시'];
  const lines = rsvps.map((rsvp, index) => [
    `가족 ${index + 1}`,
    rsvp.fatherName,
    rsvp.motherName,
    rsvp.children.map((child) => `${child.name}(${child.age}살)`).join(', '),
    rsvp.adultCount,
    rsvp.childCount,
    rsvp.guestCount,
    rsvp.phoneNumber ?? '',
    rsvp.belongTeam ?? '',
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

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, '');
}

type Props = {
  tabs: React.ReactNode;
  onSignedOut: () => void;
  eventTitle: string;
  teamLabel: string;
  messageLabel: string;
};

export function AdminReservations({ tabs, onSignedOut, eventTitle, teamLabel, messageLabel }: Props) {
  const rsvpsQuery = useListRsvps({ query: { queryKey: getListRsvpsQueryKey(), retry: false } });
  const [query, setQuery] = useState('');
  const [printing, setPrinting] = useState(false);

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

  // Matches parent names, child names, or phone digits.
  const rows = useMemo(() => {
    const numbered = rsvps.map((rsvp, index) => ({ rsvp, number: index + 1 }));
    const text = normalize(query);
    if (!text || printing) return numbered;
    const digits = query.replace(/\D/g, '');
    return numbered.filter(({ rsvp }) => {
      const names = [rsvp.fatherName, rsvp.motherName, rsvp.name, rsvp.belongTeam ?? '', ...rsvp.children.map((child) => child.name)];
      if (names.some((name) => normalize(name).includes(text))) return true;
      return digits.length >= 3 && (rsvp.phoneNumber ?? '').replace(/\D/g, '').includes(digits);
    });
  }, [rsvps, query, printing]);

  return (
    <div className="reservations">
      <div className="tabs-row">
        {tabs}
        <div className="toolbar">
          <button className="btn btn-outline icon-btn" type="button" title="CSV로 내보내기" aria-label="CSV로 내보내기" disabled={rsvps.length === 0} onClick={() => downloadCsv(rsvps, { eventTitle, teamLabel, messageLabel })} data-testid="button-export-csv"><Download size={18} /></button>
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
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`이름, 자녀 이름, 연락처, ${teamLabel} 검색`} data-testid="input-admin-search" />
      </label>

      <div className="table-wrap">
        <table className="rsvp-table" data-testid="table-rsvps">
          <thead>
            <tr>
              <th>가족</th>
              <th>아빠</th>
              <th>엄마</th>
              <th>자녀</th>
              <th>연락처</th>
              <th>{teamLabel}</th>
              <th className="num">자녀 수</th>
              <th className="num">총 인원</th>
              <th>등록 일시</th>
            </tr>
          </thead>
          <tbody>
            {rsvpsQuery.isLoading ? (
              <tr><td colSpan={9} className="table-empty">불러오는 중…</td></tr>
            ) : rsvpsQuery.isError ? (
              <tr><td colSpan={9} className="table-empty">목록을 불러오지 못했어요. <button type="button" className="link-button" onClick={() => void rsvpsQuery.refetch()}>다시 시도</button></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="table-empty">{query ? '검색 결과가 없어요.' : '아직 RSVP가 없어요.'}</td></tr>
            ) : (
              rows.map(({ rsvp, number }) => (
                <tr key={rsvp.id} data-testid={`row-rsvp-${rsvp.id}`}>
                  <td className="muted-cell">가족 {number}</td>
                  <td>{rsvp.fatherName || '—'}</td>
                  <td>{rsvp.motherName || '—'}</td>
                  <td className="children-cell">
                    {rsvp.children.length ? rsvp.children.map((child) => child.name).join(', ') : '—'}
                    {rsvp.message && <div className="row-message">“{rsvp.message}”</div>}
                  </td>
                  <td className="nowrap">{rsvp.phoneNumber || '—'}</td>
                  <td>{rsvp.belongTeam || '—'}</td>
                  <td className="num">{rsvp.childCount}</td>
                  <td className="num strong">{rsvp.guestCount}</td>
                  <td className="muted-cell nowrap">{dateFormat.format(new Date(rsvp.createdAt))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {query && !printing && rows.length > 0 && <p className="admin-muted no-print">{rows.length}건 표시 중 · 전체 {rsvps.length}가족</p>}
    </div>
  );
}
