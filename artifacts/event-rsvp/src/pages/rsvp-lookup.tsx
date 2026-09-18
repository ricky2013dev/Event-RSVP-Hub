import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { ApiError, getGetRsvpConfirmationQueryKey, lookupRsvps, type Event, type RsvpPublic } from '@workspace/api-client-react';
import { Flourish } from '@/components/ornaments';
import { FamilyDetails, labelsFor } from '@/components/rsvp-parts';
import { RsvpShell } from '@/components/rsvp-shell';
import { useLang } from '@/lib/i18n';

function Lookup({ event }: { event: Event }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { t } = useLang();
  const [term, setTerm] = useState('');
  const [searched, setSearched] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [matches, setMatches] = useState<RsvpPublic[] | null>(null);
  const labels = labelsFor(event);

  async function lookup(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const query = term.trim();
    if (!query) return setError(t.errLookupEmpty);
    // A digits-only term is a phone number, and fewer than four digits would match too many families.
    if (/^[\d\s()+-]+$/.test(query) && query.replace(/\D/g, '').length < 4) return setError(t.errLookupDigits);
    setPending(true);
    setError('');
    try {
      setMatches(await lookupRsvps({ query }));
      setSearched(query);
    } catch (lookupError) {
      setMatches(null);
      setError(lookupError instanceof ApiError && lookupError.status === 429 ? t.errLookupThrottled : t.errLookupFailed);
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
        <h1>{t.lookupTitle}</h1>
        <p>{t.lookupLead}</p>
        <Flourish />
      </div>
      <form className="lookup-row" onSubmit={lookup} noValidate>
        <label className="field"><span className="sr-only">{t.lookupField}</span><input value={term} onChange={(e) => { setTerm(e.target.value); setError(''); }} placeholder={t.lookupPlaceholder} data-testid="input-lookup-query" /></label>
        <button className="btn btn-primary" type="submit" disabled={pending} data-testid="button-lookup">{pending ? t.searching : t.search}</button>
      </form>
      {error && <p className="error" role="alert" data-testid="status-lookup-error">{error}</p>}
      {matches && matches.length === 0 && (
        <div className="hint-box center" data-testid="text-lookup-empty">
          <p>{t.lookupNone(searched)}</p>
          <Link className="btn btn-outline" href="/rsvp/new" data-testid="button-lookup-to-new">{t.lookupToNew}</Link>
        </div>
      )}
      {matches && matches.length > 0 && (
        <>
          <p className="admin-muted">{t.lookupFound(matches.length)}</p>
          {matches.map((match) => (
            <div className="match" key={match.confirmToken} data-testid="card-lookup-match">
              <FamilyDetails labels={labels} family={{ ...match, phone: match.phoneNumberMasked }} />
              <button className="btn btn-outline" type="button" onClick={() => open(match)} data-testid="button-lookup-open">{t.lookupOpen}</button>
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
