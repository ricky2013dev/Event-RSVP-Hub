import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { getGetEventQueryKey, useGetEvent, type Event } from '@workspace/api-client-react';
import { Corners } from '@/components/ornaments';
import { useCardStyle } from '@/lib/card-styles';
import { useDocumentTitle } from '@/lib/document-title';
import { useTheme } from '@/lib/themes';

// Layout for the standalone RSVP pages: themed card, no invitation header or event details.
export function RsvpShell({ children, backLabel = '초대장으로' }: { children: (event: Event) => React.ReactNode; backLabel?: string | null }) {
  const eventQuery = useGetEvent({ query: { queryKey: getGetEventQueryKey() } });
  const event = eventQuery.data;
  useTheme(event);
  useCardStyle(event?.cardStyle);
  useDocumentTitle(event && `${event.title} RSVP`);

  return (
    <main className="page">
      <div className="topbar">
        {backLabel && <Link className="topbar-link" href="/" data-testid="link-back-invitation"><ArrowLeft size={16} /> {backLabel}</Link>}
      </div>
      <article className="card rsvp-page">
        <Corners />
        {eventQuery.isLoading ? (
          <p className="admin-muted center-text">불러오는 중…</p>
        ) : eventQuery.isError || !event ? (
          <div className="panel">
            <p className="lead">페이지를 불러오지 못했어요.</p>
            <button className="btn btn-primary" type="button" onClick={() => void eventQuery.refetch()}>다시 시도</button>
          </div>
        ) : (
          children(event)
        )}
      </article>
    </main>
  );
}
