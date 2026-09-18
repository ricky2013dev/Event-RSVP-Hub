import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarHeart, Clock3, ExternalLink, MapPin, Search, Settings, Shirt, Users } from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { getGetEventQueryKey, getGetRsvpSummaryQueryKey, useGetEvent, useGetRsvpSummary } from '@workspace/api-client-react';
import { AdminLoginForm } from '@/components/admin-login-form';
import { ErrorBoundary } from '@/components/error-boundary';
import { Corners, Flourish } from '@/components/ornaments';
import { hasAdminSession } from '@/lib/admin-session';
import { useCardStyle, useCurrentCardStyle } from '@/lib/card-styles';
import { useDocumentTitle } from '@/lib/document-title';
import { useTheme } from '@/lib/themes';
import AdminPage from '@/pages/admin';
import RsvpCompletePage from '@/pages/rsvp-complete';
import RsvpLookupPage from '@/pages/rsvp-lookup';
import RsvpNewPage from '@/pages/rsvp-new';

const queryClient = new QueryClient();

function formatDate(date: string) {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(parsed);
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours)) return time;
  const date = new Date();
  date.setHours(hours, minutes || 0, 0, 0);
  return new Intl.DateTimeFormat('en-US', minutes ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' }).format(date);
}

function Invitation() {
  const eventQuery = useGetEvent({ query: { queryKey: getGetEventQueryKey() } });
  const summaryQuery = useGetRsvpSummary({ query: { queryKey: getGetRsvpSummaryQueryKey() } });
  const [loginOpen, setLoginOpen] = useState(false);
  const [, navigate] = useLocation();

  const event = eventQuery.data;
  const summary = summaryQuery.data;
  useTheme(event);
  useCardStyle(event?.cardStyle);
  const cardStyle = useCurrentCardStyle();
  useDocumentTitle(event && `${event.title} RSVP`);

  function openAdmin() {
    if (hasAdminSession()) navigate('/admin');
    else setLoginOpen(true);
  }

  if (eventQuery.isLoading) {
    return <main className="page"><article className="card card-loading" data-testid="state-event-loading"><div className="photo-ring skeleton" /></article></main>;
  }

  if (eventQuery.isError || !event) {
    return (
      <main className="page">
        <article className="card" data-testid="state-event-error">
          <p className="lead">초대장을 불러오지 못했어요.</p>
          <button className="btn btn-primary" type="button" onClick={() => void eventQuery.refetch()} data-testid="button-retry-event">다시 시도</button>
        </article>
      </main>
    );
  }

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;
  const eventTime = event.endTime ? `${formatTime(event.startTime)} – ${formatTime(event.endTime)}` : formatTime(event.startTime);

  return (
    <main className="page">
      {loginOpen && (
        <div className="modal-backdrop" onClick={() => setLoginOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <AdminLoginForm onSuccess={() => navigate('/admin')} onCancel={() => setLoginOpen(false)} />
          </div>
        </div>
      )}
      <article className="card" data-testid="invitation-card">
        <Corners />

        <div className="photo-wrap">
          {cardStyle.sparkles.map((glyph, index) => <span className={`sparkle s${index + 1}`} key={index}>{glyph}</span>)}
          <div className="photo-ring">
            <img src={event.imageUrl} alt={event.title} data-testid="img-event" />
          </div>
        </div>

        <p className="eyebrow">{event.subtitle}</p>
        <h1 className="title" data-testid="text-event-title">{event.title} <span className="rsvp-word">RSVP</span></h1>
        <Flourish />
        <p className="lead" data-testid="text-event-description">{event.description}</p>
        {event.featuredNote && <p className="note" data-testid="text-featured-note">{event.featuredNote}</p>}

        <section className="details">
          <div className="detail"><span className="detail-icon"><CalendarHeart size={18} /></span><div><div className="detail-label">날짜</div><div className="detail-value" data-testid="text-event-date">{formatDate(event.date)}</div></div></div>
          <div className="detail"><span className="detail-icon"><Clock3 size={18} /></span><div><div className="detail-label">시간</div><div className="detail-value" data-testid="text-event-time">{eventTime}</div></div></div>
          <div className="detail">
            <span className="detail-icon"><MapPin size={18} /></span>
            <div>
              <div className="detail-label">장소</div>
              <div className="detail-value" data-testid="text-event-venue">{event.venue}</div>
              <div className="detail-value">{event.address}</div>
              <a className="map-link" href={mapUrl} target="_blank" rel="noreferrer" data-testid="link-map">지도에서 보기 <ExternalLink size={13} /></a>
            </div>
          </div>
          {event.dressCode && <div className="detail"><span className="detail-icon"><Shirt size={18} /></span><div><div className="detail-label">복장</div><div className="detail-value" data-testid="text-dress-code">{event.dressCode}</div></div></div>}
        </section>

        <div className="actions">
          <Link className="btn btn-primary" href="/rsvp/new" data-testid="button-open-rsvp">참석 RSVP</Link>
          <Link className="btn btn-outline" href="/rsvp/lookup" data-testid="button-open-lookup"><Search size={18} /> 기존 예약 확인하기</Link>
        </div>

        {event.showSummary && (
          <>
            <p className="stats-caption"><Users size={17} /> 지금까지 알려주신 참석 현황이에요</p>
            <section className="stats" data-testid="summary-grid">
              <div className="stat"><div className="stat-label">등록 가족</div><div className="stat-value" data-testid="text-families">{summary?.attendingResponses ?? '–'}<small>가족</small></div></div>
              <div className="stat highlight"><div className="stat-label">총 참석 예정 인원</div><div className="stat-value" data-testid="text-total-guests">{summary?.totalGuests ?? '–'}<small>명</small></div></div>
              <div className="stat"><div className="stat-label">어른 / 자녀</div><div className="stat-value" data-testid="text-adults-children">{summary ? `${summary.totalAdults} / ${summary.totalChildren}` : '–'}<small>명</small></div></div>
            </section>
          </>
        )}

        <p className="footnote">입력하신 정보는 RSVP 목적으로만 사용되며<br />행사 종료 후 안전하게 폐기됩니다.</p>
        <button className="gear card-gear" type="button" aria-label="관리자" onClick={openAdmin} data-testid="button-open-admin"><Settings size={16} /></button>
      </article>
    </main>
  );
}

// Links saved before the RSVP pages existed looked like /?rsvp=<token>.
function Home() {
  const token = new URLSearchParams(window.location.search).get('rsvp');
  return token ? <Redirect to={`/rsvp/complete?token=${encodeURIComponent(token)}`} replace /> : <Invitation />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ErrorBoundary>
          <Switch>
            <Route path="/admin" component={AdminPage} />
            <Route path="/rsvp/new" component={RsvpNewPage} />
            <Route path="/rsvp/lookup" component={RsvpLookupPage} />
            <Route path="/rsvp/complete" component={RsvpCompletePage} />
            <Route path="/" component={Home} />
            <Route><Redirect to="/" /></Route>
          </Switch>
        </ErrorBoundary>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
