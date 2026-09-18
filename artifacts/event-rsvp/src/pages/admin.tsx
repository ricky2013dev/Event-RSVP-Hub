import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft, Check, ClipboardList, Home, ImageUp, LogOut } from 'lucide-react';
import {
  ApiError,
  getGetEventQueryKey,
  getGetRsvpSummaryQueryKey,
  getListRsvpsQueryKey,
  useGetEvent,
  useUpdateEvent,
  type Event,
  type EventInput,
  type EventTheme,
} from '@workspace/api-client-react';
import { AdminLoginForm } from '@/components/admin-login-form';
import { AdminReservations } from '@/components/admin-reservations';
import { clearAdminToken, hasAdminSession } from '@/lib/admin-session';
import { useDocumentTitle } from '@/lib/document-title';
import { THEMES, useTheme } from '@/lib/themes';

type TextField = Exclude<keyof EventInput, 'capacity' | 'theme'>;

function toInput(event: Event): EventInput {
  const { id: _id, ...rest } = event;
  return { ...rest, date: event.date.slice(0, 10) };
}

// Shrink uploads so the photo stays small enough to store with the event.
function resizeImage(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not read image'));
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function EventEditor({ onSignedOut, onPreviewTheme }: { onSignedOut: () => void; onPreviewTheme: (theme: EventTheme) => void }) {
  const queryClient = useQueryClient();
  const eventQuery = useGetEvent({ query: { queryKey: getGetEventQueryKey() } });
  const updateEvent = useUpdateEvent();
  const [form, setForm] = useState<EventInput | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (eventQuery.data && !form) setForm(toInput(eventQuery.data));
  }, [eventQuery.data, form]);

  useEffect(() => {
    if (form) onPreviewTheme(form.theme);
  }, [form?.theme, onPreviewTheme]);

  if (!form) return <p className="admin-muted">불러오는 중…</p>;

  function set<Key extends keyof EventInput>(key: Key, value: EventInput[Key]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setStatus(null);
  }

  function text(key: TextField, label: string, options: { hint?: string; type?: string; multiline?: boolean } = {}) {
    return (
      <label className="field">
        <span>{label}{options.hint && <em> · {options.hint}</em>}</span>
        {options.multiline
          ? <textarea value={form![key]} onChange={(e) => set(key, e.target.value)} data-testid={`input-event-${key}`} />
          : <input type={options.type ?? 'text'} value={form![key]} onChange={(e) => set(key, e.target.value)} data-testid={`input-event-${key}`} />}
      </label>
    );
  }

  async function pickImage(fileEvent: React.ChangeEvent<HTMLInputElement>) {
    const file = fileEvent.target.files?.[0];
    fileEvent.target.value = '';
    if (!file) return;
    try {
      set('imageUrl', await resizeImage(file));
    } catch {
      setStatus({ kind: 'error', text: '사진을 읽지 못했어요. 다른 파일로 시도해 주세요.' });
    }
  }

  function save(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!form!.title.trim()) return setStatus({ kind: 'error', text: '제목을 입력해 주세요.' });
    if (!form!.date || !form!.startTime) return setStatus({ kind: 'error', text: '날짜와 시작 시간을 입력해 주세요.' });

    updateEvent.mutate(
      { data: { ...form!, capacity: Math.max(0, Math.round(form!.capacity || 0)) } },
      {
        onSuccess: (saved) => {
          queryClient.setQueryData(getGetEventQueryKey(), saved);
          void queryClient.invalidateQueries({ queryKey: getGetRsvpSummaryQueryKey() });
          setForm(toInput(saved));
          setStatus({ kind: 'ok', text: '저장했어요. 초대장에 바로 반영돼요.' });
        },
        onError: (error) => {
          if (isUnauthorized(error)) return onSignedOut();
          setStatus({ kind: 'error', text: '저장하지 못했어요. 입력값을 확인해 주세요.' });
        },
      },
    );
  }


  return (
    <>
      <form className="admin-form" onSubmit={save} noValidate>
        <section className="admin-section">
          <h2>색상 테마 <span className="admin-muted">선택하면 바로 미리보기돼요 · 저장해야 초대장에 반영</span></h2>
          <div className="theme-grid" role="radiogroup" aria-label="색상 테마">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                role="radio"
                aria-checked={form.theme === theme.id}
                className={`theme-option ${form.theme === theme.id ? 'selected' : ''}`}
                onClick={() => set('theme', theme.id)}
                data-testid={`button-theme-${theme.id}`}
              >
                <span className="theme-swatch" style={{ background: theme.colors.bg, borderColor: theme.colors.gold }}>
                  <span className="theme-dot" style={{ background: theme.colors.card, borderColor: theme.colors.gold }} />
                  <span className="theme-bar" style={{ background: theme.colors.rose }} />
                </span>
                <span className="theme-name">{theme.name}</span>
                {form.theme === theme.id && <span className="theme-check"><Check size={12} /></span>}
              </button>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <h2>초대장 문구</h2>
          {text('subtitle', '머리말', { hint: '제목 위 작은 글씨' })}
          {text('title', '제목', { hint: '뒤에 RSVP가 붙어요' })}
          {text('description', '인사말', { multiline: true })}
          {text('featuredNote', '추가 안내', { hint: '비워두면 표시 안 함', multiline: true })}
        </section>

        <section className="admin-section">
          <h2>RSVP 양식 <span className="admin-muted">비워두면 그 항목은 양식에서 숨겨져요</span></h2>
          {text('belongTeamLabel', '소속 항목 이름', { hint: '예: 소속 팀, 목장, 반' })}
          {text('messageLabel', '메시지 항목 이름', { hint: '예: 축하 메시지' })}
          {text('messagePlaceholder', '메시지 안내 문구', { hint: '입력칸 안에 흐리게 보이는 글' })}
        </section>

        <section className="admin-section">
          <h2>사진</h2>
          <div className="photo-edit">
            <div className="photo-ring small">{form.imageUrl && <img src={form.imageUrl} alt="" />}</div>
            <div className="photo-edit-actions">
              <label className="btn btn-outline file-btn">
                <ImageUp size={18} /> 사진 올리기
                <input type="file" accept="image/*" onChange={(e) => void pickImage(e)} data-testid="input-event-image-file" />
              </label>
              <p className="admin-muted">또는 이미지 주소를 붙여넣으세요</p>
            </div>
          </div>
          <label className="field">
            <span>이미지 주소</span>
            <input value={form.imageUrl.startsWith('data:') ? '(업로드한 사진)' : form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} onFocus={(e) => e.target.select()} data-testid="input-event-imageUrl" />
          </label>
        </section>

        <section className="admin-section">
          <h2>날짜 · 시간</h2>
          {text('date', '날짜', { type: 'date' })}
          <div className="admin-row">
            {text('startTime', '시작', { type: 'time' })}
            {text('endTime', '종료', { type: 'time', hint: '선택' })}
          </div>
          {text('timezone', '시간대', { hint: '예: America/Chicago' })}
        </section>

        <section className="admin-section">
          <h2>장소</h2>
          {text('venue', '장소 이름')}
          {text('address', '주소', { hint: '지도 링크에 사용돼요' })}
          {text('dressCode', '복장 안내', { hint: '비워두면 표시 안 함' })}
        </section>

        <section className="admin-section">
          <h2>기타</h2>
          {text('hostName', '주최')}
          <label className="field">
            <span>최대 인원</span>
            <input type="number" min={0} inputMode="numeric" value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))} data-testid="input-event-capacity" />
          </label>
        </section>

        {status && <p className={status.kind === 'ok' ? 'notice' : 'error'} role="status" data-testid="status-admin-save">{status.kind === 'ok' && <Check size={16} />} {status.text}</p>}
        <button className="btn btn-primary sticky-save" type="submit" disabled={updateEvent.isPending} data-testid="button-save-event">{updateEvent.isPending ? '저장 중…' : '저장하기'}</button>
      </form>

    </>
  );
}

type AdminTab = 'reservations' | 'settings';

function initialTab(): AdminTab {
  return new URLSearchParams(window.location.search).get('tab') === 'settings' ? 'settings' : 'reservations';
}

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(hasAdminSession);
  const [previewTheme, setPreviewTheme] = useState<EventTheme | null>(null);
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const queryClient = useQueryClient();
  const eventQuery = useGetEvent({ query: { queryKey: getGetEventQueryKey() } });
  useTheme(previewTheme ?? eventQuery.data?.theme);
  useDocumentTitle(eventQuery.data && `RSVP 관리자 · ${eventQuery.data.title}`);

  function selectTab(next: AdminTab) {
    setTab(next);
    // Leaving the editor drops any unsaved theme preview.
    if (next === 'reservations') setPreviewTheme(null);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url);
  }

  const signOut = useCallback(() => {
    clearAdminToken();
    setPreviewTheme(null);
    queryClient.removeQueries({ queryKey: getListRsvpsQueryKey() });
    setSignedIn(false);
  }, [queryClient]);

  if (!signedIn) {
    return (
      <main className="page">
        <div className="topbar">
          <Link className="topbar-link" href="/" data-testid="link-invitation"><ArrowLeft size={16} /> 초대장</Link>
        </div>
        <article className="card admin-card">
          <AdminLoginForm onSuccess={() => setSignedIn(true)} />
        </article>
      </main>
    );
  }

  const tabs = (
    <div className="tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === 'reservations'} className={tab === 'reservations' ? 'on' : ''} onClick={() => selectTab('reservations')} data-testid="tab-reservations"><ClipboardList size={17} /> 예약 현황</button>
      <button type="button" role="tab" aria-selected={tab === 'settings'} className={tab === 'settings' ? 'on' : ''} onClick={() => selectTab('settings')} data-testid="tab-settings"><ImageUp size={17} /> 초대장 설정</button>
    </div>
  );

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>RSVP 관리자</h1>
          <p>{eventQuery.data?.title ?? '행사'} 참석 예약 현황</p>
        </div>
        <nav className="admin-header-actions">
          <Link className="topbar-link" href="/" data-testid="link-invitation"><Home size={16} /> 초대장</Link>
          <button className="btn btn-outline btn-small" type="button" onClick={signOut} data-testid="button-admin-logout"><LogOut size={16} /> 로그아웃</button>
        </nav>
      </header>

      <div className="admin-body">
        {tab === 'reservations' ? (
          <AdminReservations
            tabs={tabs}
            onSignedOut={signOut}
            eventTitle={eventQuery.data?.title ?? 'RSVP'}
            teamLabel={eventQuery.data?.belongTeamLabel.trim() || '소속'}
            messageLabel={eventQuery.data?.messageLabel.trim() || '메시지'}
          />
        ) : (
          <>
            <div className="tabs-row">{tabs}</div>
            <article className="card admin-card">
              <EventEditor onSignedOut={signOut} onPreviewTheme={setPreviewTheme} />
            </article>
          </>
        )}
      </div>
    </main>
  );
}
