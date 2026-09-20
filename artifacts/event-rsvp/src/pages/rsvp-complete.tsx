import { useState } from 'react';
import { Link, useSearch } from 'wouter';
import { Check, Copy } from 'lucide-react';
import { getGetRsvpConfirmationQueryKey, useGetRsvpConfirmation, type Event } from '@workspace/api-client-react';
import { Flourish } from '@/components/ornaments';
import { FamilyDetails, labelsFor, TotalBar } from '@/components/rsvp-parts';
import { RsvpShell } from '@/components/rsvp-shell';
import { useLang } from '@/lib/i18n';

function Complete({ event }: { event: Event }) {
  const { t } = useLang();
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
        <h1>{t.notFoundTitle}</h1>
        <p>{t.notFoundLead}</p>
        <Link className="btn btn-outline" href="/rsvp/lookup">{t.lookupTitle}</Link>
      </div>
    );
  }

  return (
    <div className="panel done" data-testid="status-rsvp-saved">
      <span className="done-icon"><Check size={24} /></span>
      <h1 data-testid="text-complete-message">{fromLookup ? t.confirmedLookup : t.confirmedNew}<br />{t.seeYouAt(event.title)}</h1>
      <Flourish />
      {familyQuery.isLoading || !family ? (
        <p>{t.loadingDetails}</p>
      ) : (
        <>
          <p>{t.registeredAs}</p>
          <FamilyDetails labels={labelsFor(event)} family={{ ...family, phone: family.phoneNumberMasked }} />
          <TotalBar adults={family.adultCount} children={family.childCount} isFamilyType={event.isFamilyType} testId="text-complete-total" />
          <p className="footnote">{t.saveLink1}<br />{t.saveLink2}</p>
          <button className="btn btn-outline" type="button" onClick={() => void copyLink()} data-testid="button-copy-link">{copied ? <><Check size={16} /> {t.copied}</> : <><Copy size={16} /> {t.copyLink}</>}</button>
        </>
      )}
      <Link className="back center" href="/" data-testid="button-done-home">{t.back}</Link>
    </div>
  );
}

export default function RsvpCompletePage() {
  return <RsvpShell showBack={false}>{(event) => <Complete event={event} />}</RsvpShell>;
}
