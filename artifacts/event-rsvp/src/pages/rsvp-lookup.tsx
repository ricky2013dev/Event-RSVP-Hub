import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Search } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import {
  ApiError,
  getGetRsvpConfirmationQueryKey,
  getListPublicRsvpsQueryKey,
  lookupRsvps,
  useListPublicRsvps,
  type Event,
  type RsvpPublic,
} from '@workspace/api-client-react';
import { Flourish } from '@/components/ornaments';
import { FamilyDetails, labelsFor, optionLabel } from '@/components/rsvp-parts';
import { RsvpShell } from '@/components/rsvp-shell';
import { useLang, LOCALE } from '@/lib/i18n';
import { matchesSearch } from '@/lib/rsvp-search';

// Opening an RSVP hands the confirmation page the record it already has, so it shows at once.
function useOpenRsvp() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  return (match: RsvpPublic) => {
    queryClient.setQueryData(getGetRsvpConfirmationQueryKey(match.confirmToken), match);
    navigate(`/rsvp/complete?token=${match.confirmToken}&from=lookup`);
  };
}

function displayName(match: RsvpPublic) {
  return [match.fatherName, match.motherName].filter(Boolean).join(' · ');
}

// With the admin's "등록 명단 공개" switch on, every RSVP is listed and the box only
// filters what is already on the page — no lookup call, so partial names match too.
function LookupList({ event }: { event: Event }) {
  const { t, lang } = useLang();
  const open = useOpenRsvp();
  const [term, setTerm] = useState('');
  const listQuery = useListPublicRsvps({ query: { queryKey: getListPublicRsvpsQueryKey() } });
  const labels = labelsFor(event);

  const matches = useMemo(() => {
    const rsvps = [...(listQuery.data ?? [])].sort((a, b) => displayName(a).localeCompare(displayName(b), LOCALE[lang]));
    return rsvps.filter((match) =>
      matchesSearch(
        { ...match, phoneNumber: match.phoneNumberMasked },
        term,
        optionLabel(labels.deptOptions, match.belongDept),
      ),
    );
  }, [listQuery.data, term, lang, labels.deptOptions]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>{t.lookupTitle}</h1>
        <p>{t.lookupListLead}</p>
        <Flourish />
      </div>
      <label className="search-box">
        <Search size={18} />
        <span className="sr-only">{t.lookupFilterField}</span>
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t.lookupFilterPlaceholder} data-testid="input-lookup-query" />
      </label>
      {listQuery.isLoading ? (
        <p className="admin-muted center-text">{t.loading}</p>
      ) : listQuery.isError ? (
        <div className="hint-box center">
          <p>{t.pageError}</p>
          <button className="btn btn-outline" type="button" onClick={() => void listQuery.refetch()}>{t.tryAgain}</button>
        </div>
      ) : matches.length === 0 ? (
        <div className="hint-box center" data-testid="text-lookup-empty">
          <p>{term.trim() ? t.lookupNone(term.trim()) : t.lookupListEmpty}</p>
          <Link className="btn btn-outline" href="/rsvp/new" data-testid="button-lookup-to-new">{t.lookupToNew}</Link>
        </div>
      ) : (
        <>
          <p className="admin-muted">{t.lookupListCount(matches.length)}</p>
          <ul className="rsvp-list" data-testid="list-lookup-all">
            {matches.map((match) => (
              <li key={match.confirmToken}>
                <button className="rsvp-list-row" type="button" onClick={() => open(match)} data-testid="button-lookup-open">
                  <span className="rsvp-list-text">
                    <span className="rsvp-list-name">{displayName(match)}</span>
                    {labels.isFamilyType && match.children.length > 0 && (
                      <span className="rsvp-list-sub">{match.children.map((child) => child.name).join(', ')}</span>
                    )}
                  </span>
                  <ChevronRight size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// The default: nothing is listed, and a whole name or the last phone digits finds one family.
function LookupSearch({ event }: { event: Event }) {
  const { t } = useLang();
  const open = useOpenRsvp();
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
  return <RsvpShell>{(event) => (event.showAllRsvp ? <LookupList event={event} /> : <LookupSearch event={event} />)}</RsvpShell>;
}
