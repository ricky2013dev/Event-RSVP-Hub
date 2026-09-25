import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { getGetEventQueryKey, useGetEvent, type Event } from '@workspace/api-client-react';
import { Corners, Flourish } from '@/components/ornaments';
import { useCardStyle } from '@/lib/card-styles';
import { useDocumentTitle } from '@/lib/document-title';
import { useLang } from '@/lib/i18n';
import { useTheme } from '@/lib/themes';

// Layout for the standalone RSVP pages: themed card, no invitation header or event details.
// `showBack` is off on the confirmation page, which offers its own way back.
// Once the admin closes RSVPs every page shows only the closed notice, so no RSVP data is reachable.
export function RsvpShell({ children, showBack = true }: { children: (event: Event) => React.ReactNode; showBack?: boolean }) {
  const { t } = useLang();
  const eventQuery = useGetEvent({ query: { queryKey: getGetEventQueryKey() } });
  const event = eventQuery.data;
  useTheme(event);
  useCardStyle(event?.cardStyle);
  useDocumentTitle(event && `${event.title} RSVP`);

  return (
    <main className="page">
      {showBack && (
        <div className="topbar">
          <Link className="topbar-link" href="/" data-testid="link-back-invitation"><ArrowLeft size={16} /> {t.back}</Link>
        </div>
      )}
      <article className="card rsvp-page">
        <Corners />
        {eventQuery.isLoading ? (
          <p className="admin-muted center-text">{t.loading}</p>
        ) : eventQuery.isError || !event ? (
          <div className="panel">
            <p className="lead">{t.pageError}</p>
            <button className="btn btn-primary" type="button" onClick={() => void eventQuery.refetch()}>{t.tryAgain}</button>
          </div>
        ) : event.rsvpClosed ? (
          <div className="panel done" data-testid="status-rsvp-closed">
            <h1>{t.closedTitle}</h1>
            <Flourish />
            <p>{t.closedLead}</p>
            {!showBack && <Link className="back center" href="/">{t.back}</Link>}
          </div>
        ) : (
          children(event)
        )}
      </article>
    </main>
  );
}
