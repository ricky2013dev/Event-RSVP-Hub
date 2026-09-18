import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Shirt,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  getGetEventQueryKey,
  getGetRsvpSummaryQueryKey,
  getListRsvpsQueryKey,
  useCreateRsvp,
  useGetEvent,
  useGetRsvpSummary,
  useListRsvps,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type Attendance = 'attending' | 'declined';
type MealPreference = 'noPreference' | 'vegetarian' | 'vegan' | 'glutenFree';
type FormState = {
  name: string;
  email: string;
  attendance: Attendance;
  guestCount: number;
  mealPreference: MealPreference;
  dietaryNotes: string;
  message: string;
};

const initialForm: FormState = {
  name: '',
  email: '',
  attendance: 'attending',
  guestCount: 1,
  mealPreference: 'noPreference',
  dietaryNotes: '',
  message: '',
};

function formatDate(date: string) {
  const normalized = date.slice(0, 10);
  const parsed = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours)) return time;
  const date = new Date();
  date.setHours(hours, minutes || 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function Home() {
  const queryClient = useQueryClient();
  const eventQuery = useGetEvent({ query: { queryKey: getGetEventQueryKey() } });
  const rsvpsQuery = useListRsvps({ query: { queryKey: getListRsvpsQueryKey() } });
  const summaryQuery = useGetRsvpSummary({ query: { queryKey: getGetRsvpSummaryQueryKey() } });
  const createRsvp = useCreateRsvp();
  const [form, setForm] = useState<FormState>(initialForm);
  const [formError, setFormError] = useState('');
  const [savedRsvp, setSavedRsvp] = useState<{ name: string; attendance: Attendance } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const event = eventQuery.data;
  const summary = summaryQuery.data;
  const rsvps = rsvpsQuery.data ?? [];
  const capacity = summary?.capacity ?? event?.capacity ?? 0;
  const totalGuests = summary?.totalGuests ?? 0;
  const spotsRemaining = Math.max(summary?.spotsRemaining ?? capacity - totalGuests, 0);
  const capacityPercent = capacity ? Math.min(100, (totalGuests / capacity) * 100) : 0;

  function setField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  }

  function submitRsvp(eventObject: React.FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    if (!form.name.trim()) {
      setFormError('Please add your name so we know who is joining us.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setFormError('Please add a valid email address for your invitation details.');
      return;
    }

    createRsvp.mutate(
      {
        data: {
          name: form.name.trim(),
          email: form.email.trim(),
          attendance: form.attendance,
          guestCount: form.attendance === 'declined' ? 0 : form.guestCount,
          mealPreference: form.mealPreference,
          dietaryNotes: form.dietaryNotes.trim() || null,
          message: form.message.trim() || null,
        },
      },
      {
        onSuccess: (saved) => {
          void queryClient.invalidateQueries({ queryKey: getListRsvpsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetRsvpSummaryQueryKey() });
          setSavedRsvp({ name: saved.name, attendance: saved.attendance });
          setForm(initialForm);
          setFormError('');
        },
        onError: () => {
          setFormError('We could not save that just now. Please try again in a moment.');
        },
      },
    );
  }

  if (eventQuery.isLoading) {
    return (
      <main className="page-shell" data-testid="state-event-loading">
        <div className="topbar"><span className="mark"><span className="mark-seal">NG</span> The Night Garden</span></div>
        <div className="hero">
          <div className="hero-copy"><span className="skeleton" style={{ width: '120px' }} /><span className="skeleton" style={{ width: '90%', height: '150px', marginTop: '25px' }} /><span className="skeleton" style={{ width: '70%', marginTop: '25px' }} /></div>
          <div className="hero-art"><div className="hero-art-frame" /></div>
        </div>
      </main>
    );
  }

  if (eventQuery.isError || !event) {
    return (
      <main className="page-shell" data-testid="state-event-error">
        <div className="topbar"><span className="mark"><span className="mark-seal">NG</span> The Night Garden</span></div>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">A little pause in the season</span>
            <h1>Something went quiet.</h1>
            <p className="hero-description">The invitation is taking a moment to arrive. Please try again.</p>
            <button className="button" type="button" onClick={() => void eventQuery.refetch()} data-testid="button-retry-event">Try again</button>
          </div>
        </section>
      </main>
    );
  }

  const eventDate = formatDate(event.date);
  const eventTime = `${formatTime(event.startTime)} — ${formatTime(event.endTime)}`;

  return (
    <main className="page-shell" data-testid="page-night-garden">
      <header className="topbar">
        <a className="mark" href="#top" data-testid="link-home"><span className="mark-seal">NG</span> The Night Garden</a>
        <span className="topbar-note">An invitation from {event.hostName}</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">A little pause in the season</span>
          <h1 data-testid="text-event-title">{event.title}</h1>
          <p className="hero-subtitle" data-testid="text-event-subtitle">{event.subtitle}</p>
          <p className="hero-description" data-testid="text-event-description">{event.description}</p>
          <div className="hero-actions">
            <a className="button" href="#rsvp" data-testid="link-rsvp">Tell us you’re coming <ArrowDown size={16} /></a>
            <a className="button ghost" href="#details" data-testid="link-details">Read the details</a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-frame">
            {event.imageUrl && !imageFailed ? <img className="hero-photo" src={event.imageUrl} alt="" onError={() => setImageFailed(true)} /> : null}
          </div>
          <div className="hero-art-label"><Sparkles size={14} /> After dusk · together</div>
        </div>
      </section>

      <section className="info-strip" aria-label="Event overview">
        <div className="info-item" data-testid="info-date">
          <div className="info-label">When</div>
          <div className="info-value">{eventDate}</div>
          <div className="info-secondary">{eventTime} · {event.timezone}</div>
        </div>
        <div className="info-item" data-testid="info-venue">
          <div className="info-label">Where</div>
          <div className="info-value">{event.venue}</div>
          <div className="info-secondary">{event.address}</div>
        </div>
        <div className="info-item" data-testid="info-dress-code">
          <div className="info-label">Dress code</div>
          <div className="info-value">{event.dressCode}</div>
          <div className="info-secondary">Come as you are, beautifully.</div>
        </div>
      </section>

      <section className="content-grid" id="details">
        <div>
          <span className="section-kicker">The evening</span>
          <h2 className="section-title">A garden after dark.</h2>
          <p className="story-copy">We’ll gather as the light softens, with something good in our glasses and the garden doing what it does best: making everyone linger. There will be food, music, and plenty of room for a long conversation.</p>
          <div className="featured-note" data-testid="text-featured-note">{event.featuredNote}</div>
        </div>
        <div className="details-card">
          <span className="section-kicker">Keep this close</span>
          <div className="details-list">
            <div className="detail-row"><CalendarDays size={19} /><div><div className="detail-name">Date</div><div className="detail-value">{eventDate}</div></div></div>
            <div className="detail-row"><Clock3 size={19} /><div><div className="detail-name">Time</div><div className="detail-value">{eventTime} <span className="response-muted">{event.timezone}</span></div></div></div>
            <div className="detail-row"><MapPin size={19} /><div><div className="detail-name">Place</div><div className="detail-value">{event.venue}<br /><span className="response-muted">{event.address}</span></div></div></div>
            <div className="detail-row"><Shirt size={19} /><div><div className="detail-name">What to wear</div><div className="detail-value">{event.dressCode}</div></div></div>
          </div>
        </div>
      </section>

      <section className="rsvp-section" id="rsvp">
        <div className="rsvp-inner">
          <div className="rsvp-layout">
            <div>
              <span className="section-kicker">Make it official</span>
              <h2 className="section-title">Will we see you there?</h2>
              <p className="rsvp-copy">A quick note is all we need. You can always come back and update your answer later with the same email address.</p>
              <div className="rsvp-meta">
                <div className="rsvp-meta-item"><Users size={14} /> {spotsRemaining} spots left</div>
                <div className="rsvp-meta-item"><Clock3 size={14} /> reply by the week before</div>
              </div>
            </div>
            <div className="form-card">
              {savedRsvp ? (
                <div className="success-card" data-testid="status-rsvp-saved">
                  <div className="success-icon"><Check size={20} /></div>
                  <h3>Thank you, {savedRsvp.name}.</h3>
                  <p>{savedRsvp.attendance === 'attending' ? 'Your place in the garden is saved. We’ll keep the lanterns lit for you.' : 'We’re sorry to miss you, and grateful you let us know.'}</p>
                  <button className="button ghost" type="button" onClick={() => setSavedRsvp(null)} data-testid="button-update-rsvp">Send another update</button>
                </div>
              ) : (
                <>
                  <h3>Your RSVP</h3>
                  <p className="form-intro">Whether you’re joining us or sending your warmest regrets, we’d love to hear from you.</p>
                  <form onSubmit={submitRsvp} noValidate>
                    <div className="form-grid">
                      <div className="field full">
                        <label htmlFor="name">Your name</label>
                        <input id="name" value={form.name} onChange={(inputEvent) => setField('name', inputEvent.target.value)} placeholder="First and last name" data-testid="input-name" />
                      </div>
                      <div className="field full">
                        <label htmlFor="email">Email address</label>
                        <input id="email" type="email" value={form.email} onChange={(inputEvent) => setField('email', inputEvent.target.value)} placeholder="Where should we send the details?" data-testid="input-email" />
                      </div>
                      <div className="field full">
                        <label>Will you be joining us?</label>
                        <div className="attendance">
                          <button className={`attendance-button ${form.attendance === 'attending' ? 'selected' : ''}`} type="button" onClick={() => { setField('attendance', 'attending'); if (form.guestCount === 0) setField('guestCount', 1); }} data-testid="button-attending"><strong>Yes, I’ll be there</strong><small>Save me a seat</small></button>
                          <button className={`attendance-button ${form.attendance === 'declined' ? 'selected' : ''}`} type="button" onClick={() => { setField('attendance', 'declined'); setField('guestCount', 0); }} data-testid="button-declined"><strong>With warm regrets</strong><small>Send my love from afar</small></button>
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="guest-count">Number of guests</label>
                        <select id="guest-count" value={form.guestCount} disabled={form.attendance === 'declined'} onChange={(inputEvent) => setField('guestCount', Number(inputEvent.target.value))} data-testid="select-guest-count">
                          {[0, 1, 2, 3, 4, 5].map((count) => <option value={count} key={count}>{count === 0 ? 'Just me' : `${count} ${count === 1 ? 'person' : 'people'}`}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="meal-preference">Meal preference</label>
                        <select id="meal-preference" value={form.mealPreference} onChange={(inputEvent) => setField('mealPreference', inputEvent.target.value as MealPreference)} data-testid="select-meal-preference">
                          <option value="noPreference">No preference</option>
                          <option value="vegetarian">Vegetarian</option>
                          <option value="vegan">Vegan</option>
                          <option value="glutenFree">Gluten free</option>
                        </select>
                      </div>
                      <div className="field full">
                        <label htmlFor="dietary-notes">Dietary notes <span className="response-muted">(optional)</span></label>
                        <input id="dietary-notes" value={form.dietaryNotes} onChange={(inputEvent) => setField('dietaryNotes', inputEvent.target.value)} placeholder="Anything our kitchen should know?" data-testid="input-dietary-notes" />
                      </div>
                      <div className="field full">
                        <label htmlFor="message">A note for the hosts <span className="response-muted">(optional)</span></label>
                        <textarea id="message" value={form.message} onChange={(inputEvent) => setField('message', inputEvent.target.value)} placeholder="A little something, if you’d like..." data-testid="input-message" />
                      </div>
                    </div>
                    <div className="submit-row">
                      <span className="response-muted">Your details stay with the hosts.</span>
                      <button className="button" type="submit" disabled={createRsvp.isPending} data-testid="button-submit-rsvp">{createRsvp.isPending ? 'Saving your place…' : 'Save my RSVP'} <Check size={16} /></button>
                    </div>
                    {formError ? <div className="form-error" role="alert" data-testid="status-form-error">{formError}</div> : null}
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="organizer-section" aria-labelledby="attendance-heading">
        <div className="organizer-header">
          <div><span className="section-kicker">For the hosts</span><h2 className="section-title" id="attendance-heading">A little headcount.</h2></div>
          <p className="organizer-caption">A quiet view of the evening as replies arrive. This summary updates after every RSVP.</p>
        </div>
        {summaryQuery.isLoading ? <div className="summary-grid" data-testid="state-summary-loading">{[1, 2, 3, 4].map((item) => <div className="summary-card" key={item}><span className="skeleton" /></div>)}</div> : summaryQuery.isError ? <div className="error-state" data-testid="state-summary-error">The headcount is resting. <button className="retry-button" type="button" onClick={() => void summaryQuery.refetch()} data-testid="button-retry-summary">Refresh summary</button></div> : (
          <div className="summary-grid" data-testid="summary-grid">
            <div className="summary-card primary"><div className="summary-label">Guests expected</div><div className="summary-number" data-testid="text-total-guests">{summary?.totalGuests ?? 0} <span className="response-muted">/ {capacity}</span></div><div className="capacity-track"><div className="capacity-fill" style={{ width: `${capacityPercent}%` }} /></div></div>
            <div className="summary-card"><div className="summary-label">Replies</div><div className="summary-number" data-testid="text-total-responses">{summary?.totalResponses ?? 0}</div></div>
            <div className="summary-card"><div className="summary-label">Joining</div><div className="summary-number" data-testid="text-attending-responses">{summary?.attendingResponses ?? 0}</div></div>
            <div className="summary-card"><div className="summary-label">Regrets</div><div className="summary-number" data-testid="text-declined-responses">{summary?.declinedResponses ?? 0}</div></div>
          </div>
        )}
        {rsvpsQuery.isLoading ? <div className="empty-state" data-testid="state-rsvps-loading"><span className="skeleton" /></div> : rsvpsQuery.isError ? <div className="error-state" data-testid="state-rsvps-error">Responses could not be loaded. <button className="retry-button" type="button" onClick={() => void rsvpsQuery.refetch()} data-testid="button-retry-rsvps">Refresh responses</button></div> : rsvps.length === 0 ? <div className="empty-state" data-testid="state-rsvps-empty">No replies yet. The first note is always the sweetest.</div> : (
          <div className="response-list" data-testid="response-list">
            {rsvps.map((rsvp) => <div className="response-row" key={rsvp.id} data-testid={`row-rsvp-${rsvp.id}`}><div><div className="response-name">{rsvp.name}</div><div className="response-muted">{rsvp.email}</div></div><span className={`status-pill ${rsvp.attendance === 'declined' ? 'declined' : ''}`}>{rsvp.attendance === 'attending' ? 'Joining' : 'Regrets'}</span><span className="response-muted">{rsvp.attendance === 'attending' ? `${rsvp.guestCount} ${rsvp.guestCount === 1 ? 'guest' : 'guests'}` : '—'}</span><span className="response-muted">{rsvp.mealPreference === 'noPreference' ? 'No preference' : rsvp.mealPreference}</span></div>)}
          </div>
        )}
      </section>
      <footer className="footer">The Night Garden · with love from {event.hostName}</footer>
    </main>
  );
}

function Router() {
  return (
    <ErrorBoundary resetKey={useLocation()[0]}>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;