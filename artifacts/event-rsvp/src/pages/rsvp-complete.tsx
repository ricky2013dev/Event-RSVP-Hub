import { useState } from 'react';
import { Link, useSearch } from 'wouter';
import { Check, Copy } from 'lucide-react';
import { getGetRsvpConfirmationQueryKey, useGetRsvpConfirmation, type Event } from '@workspace/api-client-react';
import { Flourish } from '@/components/ornaments';
import { FamilyDetails, labelsFor, TotalBar } from '@/components/rsvp-parts';
import { RsvpShell } from '@/components/rsvp-shell';

function Complete({ event }: { event: Event }) {
  const params = new URLSearchParams(useSearch());
  const token = params.get('token') ?? '';
  // Same content from lookup, but a guest who is only re-checking shouldn't be told they just registered.
  const fromLookup = params.get('from') === 'lookup';
  const familyQuery = useGetRsvpConfirmation(token, {
    query: { queryKey: getGetRsvpConfirmationQueryKey(token), enabled: Boolean(token), retry: false, staleTime: 5 * 60 * 1000 },
  });
  const [copied, setCopied] = useState(false);
  const family = familyQuery.data;

  async function copyLink() {
    // Share the registration link itself, without the "from=lookup" marker.
    const url = new URL(window.location.href);
    url.searchParams.delete('from');
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!token || familyQuery.isError) {
    return (
      <div className="panel done">
        <h1>등록 내용을 찾을 수 없어요</h1>
        <p>주소가 올바른지 확인하시거나 이름으로 다시 조회해 주세요.</p>
        <Link className="btn btn-outline" href="/rsvp/lookup">기존 예약 확인하기</Link>
      </div>
    );
  }

  return (
    <div className="panel done" data-testid="status-rsvp-saved">
      <span className="done-icon"><Check size={24} /></span>
      <h1 data-testid="text-complete-message">{fromLookup ? '참석 등록이 확인되었습니다.' : 'RSVP 등록이 완료되었습니다.'}<br />{event.title}에서 뵙겠습니다!</h1>
      <Flourish />
      {familyQuery.isLoading || !family ? (
        <p>등록 정보를 불러오는 중…</p>
      ) : (
        <>
          <p>아래 내용으로 등록되어 있습니다.</p>
          <FamilyDetails labels={labelsFor(event)} family={{ ...family, phone: family.phoneNumberMasked }} />
          <TotalBar adults={family.adultCount} children={family.childCount} testId="text-complete-total" />
          <p className="footnote">이 페이지 주소를 저장해 두시면<br />언제든 등록 내용을 다시 확인하실 수 있습니다.</p>
          <button className="btn btn-outline" type="button" onClick={() => void copyLink()} data-testid="button-copy-link">{copied ? <><Check size={16} /> 주소를 복사했어요</> : <><Copy size={16} /> 이 페이지 주소 복사</>}</button>
        </>
      )}
      <Link className="back center" href="/" data-testid="button-done-home">초대장으로</Link>
    </div>
  );
}

export default function RsvpCompletePage() {
  return <RsvpShell backLabel={null}>{(event) => <Complete event={event} />}</RsvpShell>;
}
