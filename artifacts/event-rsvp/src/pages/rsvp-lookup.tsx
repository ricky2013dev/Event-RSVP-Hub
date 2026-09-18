import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { ApiError, getGetRsvpConfirmationQueryKey, lookupRsvps, type Event, type RsvpPublic } from '@workspace/api-client-react';
import { Flourish } from '@/components/ornaments';
import { FamilyDetails, labelsFor } from '@/components/rsvp-parts';
import { RsvpShell } from '@/components/rsvp-shell';

function Lookup({ event }: { event: Event }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [searched, setSearched] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [matches, setMatches] = useState<RsvpPublic[] | null>(null);
  const labels = labelsFor(event);

  async function lookup(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const query = term.trim();
    if (!query) return setError('가족 중 한 분의 이름이나 전화번호 뒷자리를 입력해 주세요.');
    // A digits-only term is a phone number, and fewer than four digits would match too many families.
    if (/^[\d\s()+-]+$/.test(query) && query.replace(/\D/g, '').length < 4) return setError('전화번호는 뒤 4자리 이상 입력해 주세요.');
    setPending(true);
    setError('');
    try {
      setMatches(await lookupRsvps({ query }));
      setSearched(query);
    } catch (lookupError) {
      setMatches(null);
      setError(lookupError instanceof ApiError && lookupError.status === 429 ? '조회 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.' : '조회하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

  function open(match: RsvpPublic) {
    queryClient.setQueryData(getGetRsvpConfirmationQueryKey(match.confirmToken), match);
    navigate(`/rsvp/complete?token=${match.confirmToken}&from=lookup`);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>기존 예약 확인</h1>
        <p>등록하실 때 적은 가족 중 한 분의 이름이나 전화번호 뒷자리를 입력해 주세요.</p>
        <Flourish />
      </div>
      <form className="lookup-row" onSubmit={lookup} noValidate>
        <label className="field"><span className="sr-only">이름 또는 전화번호 뒷자리</span><input value={term} onChange={(e) => { setTerm(e.target.value); setError(''); }} placeholder="홍길동 또는 1234" data-testid="input-lookup-query" /></label>
        <button className="btn btn-primary" type="submit" disabled={pending} data-testid="button-lookup">{pending ? '조회 중…' : '조회'}</button>
      </form>
      {error && <p className="error" role="alert" data-testid="status-lookup-error">{error}</p>}
      {matches && matches.length === 0 && (
        <div className="hint-box center" data-testid="text-lookup-empty">
          <p>‘{searched}’(으)로 등록된 내역이 없어요.</p>
          <Link className="btn btn-outline" href="/rsvp/new" data-testid="button-lookup-to-new">새로 등록하기</Link>
        </div>
      )}
      {matches && matches.length > 0 && (
        <>
          <p className="admin-muted">{matches.length}건을 찾았어요.</p>
          {matches.map((match) => (
            <div className="match" key={match.confirmToken} data-testid="card-lookup-match">
              <FamilyDetails labels={labels} family={{ ...match, phone: match.phoneNumberMasked }} />
              <button className="btn btn-outline" type="button" onClick={() => open(match)} data-testid="button-lookup-open">등록 내용 보기</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function RsvpLookupPage() {
  return <RsvpShell>{(event) => <Lookup event={event} />}</RsvpShell>;
}
