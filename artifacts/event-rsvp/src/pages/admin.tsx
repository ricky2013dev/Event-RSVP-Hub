import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft, CalendarDays, Check, ClipboardList, Grid3x3, Home, ImageUp, LogOut, Palette, Plus, ScrollText, Trash2 } from 'lucide-react';
import {
  ApiError,
  getGetEventQueryKey,
  getGetRsvpSummaryQueryKey,
  getListRsvpsQueryKey,
  useGetEvent,
  useUpdateEvent,
  type Event,
  type EventInput,
} from '@workspace/api-client-react';
import { AdminLoginForm } from '@/components/admin-login-form';
import { AdminReservations } from '@/components/admin-reservations';
import { AdminTables } from '@/components/admin-tables';
import { Flourish } from '@/components/ornaments';
import { clearAdminToken, hasAdminSession } from '@/lib/admin-session';
import { CARD_STYLES, useCardStyle } from '@/lib/card-styles';
import { useDocumentTitle } from '@/lib/document-title';
import { customTheme, THEMES, useTheme } from '@/lib/themes';

type TextField = Exclude<keyof EventInput, 'capacity' | 'theme' | 'cardStyle' | 'themeColor' | 'themeAccent' | 'belongDeptOptions' | 'tableCount' | 'showSummary' | 'isFamilyType' | 'showAllRsvp' | 'rsvpClosed'>;

// What the editor previews live, before anything is saved.
type LookPreview = Pick<EventInput, 'theme' | 'cardStyle' | 'themeColor' | 'themeAccent'>;

// The settings form is long, so it is split into panes; one save button covers them all.
type SettingsPane = 'design' | 'invitation' | 'when' | 'rsvp';

const SETTINGS_PANES: { id: SettingsPane; name: string; icon: typeof Palette }[] = [
  { id: 'design', name: '디자인', icon: Palette },
  { id: 'invitation', name: '초대장', icon: ScrollText },
  { id: 'when', name: '장소', icon: CalendarDays },
  { id: 'rsvp', name: '접수', icon: ClipboardList },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

const MAX_DEPT_OPTIONS = 20;

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

function EventEditor({ onSignedOut, onPreview }: { onSignedOut: () => void; onPreview: (preview: LookPreview) => void }) {
  const queryClient = useQueryClient();
  const eventQuery = useGetEvent({ query: { queryKey: getGetEventQueryKey() } });
  const updateEvent = useUpdateEvent();
  const [form, setForm] = useState<EventInput | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pane, setPane] = useState<SettingsPane>('design');

  useEffect(() => {
    if (eventQuery.data && !form) setForm(toInput(eventQuery.data));
  }, [eventQuery.data, form]);

  useEffect(() => {
    if (form) onPreview({ theme: form.theme, cardStyle: form.cardStyle, themeColor: form.themeColor, themeAccent: form.themeAccent });
  }, [form?.theme, form?.cardStyle, form?.themeColor, form?.themeAccent, onPreview]);

  if (!form) return <p className="admin-muted">불러오는 중…</p>;

  const custom = customTheme(form.themeColor, form.themeAccent);

  function set<Key extends keyof EventInput>(key: Key, value: EventInput[Key]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setStatus(null);
  }

  // Typing only the shown name is the common case, so the stored value follows it until it is edited.
  function setOption(index: number, patch: { value?: string; label?: string }) {
    setForm((current) => {
      if (!current) return current;
      const options = current.belongDeptOptions.map((option, at) => {
        if (at !== index) return option;
        const next = { ...option, ...patch };
        if (patch.label !== undefined && option.value === option.label) next.value = patch.label;
        return next;
      });
      return { ...current, belongDeptOptions: options };
    });
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

  function color(key: 'themeColor' | 'themeAccent', label: string, hint: string) {
    return (
      <label className="field">
        <span>{label} <em>· {hint}</em></span>
        <span className="color-well">
          <input type="color" value={form![key]} onChange={(e) => set(key, e.target.value)} data-testid={`input-event-${key}`} />
          <code>{form![key].toUpperCase()}</code>
        </span>
      </label>
    );
  }

  function check(key: 'showSummary' | 'isFamilyType' | 'showAllRsvp' | 'rsvpClosed', label: string, hint: string) {
    return (
      <label className="field field-check">
        <input type="checkbox" checked={form![key]} onChange={(e) => set(key, e.target.checked)} data-testid={`input-event-${key}`} />
        <span>{label} <em>· {hint}</em></span>
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

    // A field that fails is on a pane the user may not be looking at, so open it.
    function reject(where: SettingsPane, text: string) {
      setPane(where);
      setStatus({ kind: 'error', text });
    }

    if (!form!.title.trim()) return reject('invitation', '제목을 입력해 주세요.');
    if (!form!.date || !form!.startTime) return reject('when', '날짜와 시작 시간을 입력해 주세요.');
    if (form!.theme === 'custom' && !(HEX.test(form!.themeColor) && HEX.test(form!.themeAccent))) {
      return reject('design', '직접 고른 색상은 #RRGGBB 형식이어야 해요.');
    }

    // Blank rows are dropped; the rest must be complete and unique, or guests would see duplicates.
    const options = form!.belongDeptOptions
      .map((option) => ({ value: option.value.trim() || option.label.trim(), label: option.label.trim() || option.value.trim() }))
      .filter((option) => option.value || option.label);
    if (new Set(options.map((option) => option.value)).size !== options.length) {
      return reject('rsvp', '소속 부서 선택지의 저장 값이 중복됐어요.');
    }

    updateEvent.mutate(
      {
        data: {
          ...form!,
          belongDeptOptions: options,
          capacity: Math.max(0, Math.round(form!.capacity || 0)),
          tableCount: Math.min(50, Math.max(1, Math.round(form!.tableCount || 1))),
        },
      },
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
        <div className="subtabs" role="tablist" aria-label="초대장 설정">
          {SETTINGS_PANES.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pane === id}
              className={pane === id ? 'on' : ''}
              onClick={() => setPane(id)}
              data-testid={`subtab-${id}`}
            >
              <Icon size={16} /> {name}
            </button>
          ))}
        </div>

        {pane === 'design' && (<>
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
            <button
              type="button"
              role="radio"
              aria-checked={form.theme === 'custom'}
              className={`theme-option ${form.theme === 'custom' ? 'selected' : ''}`}
              onClick={() => set('theme', 'custom')}
              data-testid="button-theme-custom"
            >
              <span className="theme-swatch" style={{ background: custom.colors.bg, borderColor: custom.colors.gold }}>
                <span className="theme-dot" style={{ background: custom.colors.card, borderColor: custom.colors.gold }} />
                <span className="theme-bar" style={{ background: custom.colors.rose }} />
              </span>
              <span className="theme-name">직접 고르기</span>
              {form.theme === 'custom' && <span className="theme-check"><Check size={12} /></span>}
            </button>
          </div>
          {form.theme === 'custom' && (
            <div className="admin-subsection">
              <h3>색상 고르기 <span className="admin-muted">배경과 글자색은 고른 색에서 자동으로 만들어져요</span></h3>
              <div className="admin-row">
                {color('themeColor', '주 색상', '버튼과 강조')}
                {color('themeAccent', '테두리 색상', '금테와 아이콘')}
              </div>
            </div>
          )}
        </section>

        <section className="admin-section">
          <h2>카드 스타일 <span className="admin-muted">행사 종류에 맞춰 카드 모양과 장식이 바뀌어요</span></h2>
          <div className="style-grid" role="radiogroup" aria-label="카드 스타일">
            {CARD_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                role="radio"
                aria-checked={form.cardStyle === style.id}
                className={`theme-option ${form.cardStyle === style.id ? 'selected' : ''}`}
                onClick={() => set('cardStyle', style.id)}
                data-testid={`button-card-style-${style.id}`}
              >
                <span className="style-mini" data-style={style.id}>
                  <span className="style-mini-photo" />
                  <Flourish variant={style.flourish} />
                </span>
                <span className="theme-name">{style.name}</span>
                <span className="style-hint">{style.hint}</span>
                {form.cardStyle === style.id && <span className="theme-check"><Check size={12} /></span>}
              </button>
            ))}
          </div>
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
        </>)}

        {pane === 'invitation' && (<>
        <section className="admin-section">
          <h2>초대장 문구</h2>
          {text('subtitle', '머리말', { hint: '제목 위 작은 글씨' })}
          {text('title', '제목', { hint: '뒤에 RSVP가 붙어요' })}
          {text('description', '인사말', { multiline: true })}
          {text('featuredNote', '추가 안내', { hint: '비워두면 표시 안 함', multiline: true })}
          {text('hostName', '주최')}
        </section>

        <section className="admin-section">
          <h2>초대장 표시 <span className="admin-muted">손님에게 무엇까지 보여줄지 정해요</span></h2>
          {check('showSummary', '참석 현황 공개', '등록 가족 · 총 참석 예정 인원 · 어른/자녀 수를 초대장에 보여줘요')}
        </section>
        </>)}

        {pane === 'when' && (<>
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
        </>)}

        {pane === 'rsvp' && (<>
        <section className="admin-section">
          <h2>접수 상태 <span className="admin-muted">RSVP를 계속 받을지 정해요</span></h2>
          {check('rsvpClosed', 'RSVP 마감', '켜면 RSVP 페이지에 마감 안내만 보이고 등록 · 조회 · 명단은 모두 닫혀요. 관리자 화면은 그대로예요')}
        </section>

        <section className="admin-section">
          <h2>접수 단위 <span className="admin-muted">누구 이름으로 접수받을지 정해요</span></h2>
          {check('isFamilyType', '가족 단위로 접수', '아빠·엄마 이름과 자녀를 받아요. 끄면 이름 한 칸만 받고 자녀 항목은 사라져요')}
        </section>

        <section className="admin-section">
          <h2>예약 확인 방법 <span className="admin-muted">손님이 자기 예약을 어떻게 찾을지 정해요</span></h2>
          {check('showAllRsvp', '등록 명단 공개', '확인 페이지에 등록된 이름을 모두 보여주고 검색창은 그 명단을 걸러줘요. 끄면 이름·전화번호로 조회만 해요')}
        </section>

        <section className="admin-section">
          <h2>RSVP 양식 <span className="admin-muted">비워두면 그 항목은 양식에서 숨겨져요</span></h2>
          <div className="admin-row">
            {text('belongDeptLabel', '소속 부서 항목 이름', { hint: '예: 캠퍼스(캐롤톤/노스)' })}
            {text('belongTeamLabel', '소속 항목 이름', { hint: '예: 소속 팀, 목장, 반' })}
          </div>

          <div className="admin-subsection">
            <h3>소속 부서 선택지 <span className="admin-muted">비워두면 직접 입력하는 칸이 돼요 · 저장 값과 보이는 이름을 따로 정할 수 있어요</span></h3>
            {form.belongDeptOptions.map((option, index) => (
              <div className="option-row" key={index}>
                <label className="field">
                  <span>저장 값</span>
                  <input value={option.value} maxLength={50} onChange={(e) => setOption(index, { value: e.target.value })} data-testid={`input-dept-option-value-${index}`} />
                </label>
                <label className="field">
                  <span>보이는 이름</span>
                  <input value={option.label} maxLength={50} onChange={(e) => setOption(index, { label: e.target.value })} data-testid={`input-dept-option-label-${index}`} />
                </label>
                <button type="button" className="remove" onClick={() => set('belongDeptOptions', form.belongDeptOptions.filter((_, at) => at !== index))} data-testid={`button-remove-dept-option-${index}`}><Trash2 size={14} /> 삭제</button>
              </div>
            ))}
            {form.belongDeptOptions.length < MAX_DEPT_OPTIONS && (
              <button type="button" className="btn btn-dashed" onClick={() => set('belongDeptOptions', [...form.belongDeptOptions, { value: '', label: '' }])} data-testid="button-add-dept-option"><Plus size={16} /> 선택지 추가</button>
            )}
          </div>
          {text('messageLabel', '메시지 항목 이름', { hint: '예: 축하 메시지' })}
          {text('messagePlaceholder', '메시지 안내 문구', { hint: '입력칸 안에 흐리게 보이는 글' })}
        </section>

        <section className="admin-section">
          <h2>접수 규모</h2>
          <div className="admin-row">
            <label className="field">
              <span>최대 인원</span>
              <input type="number" min={0} inputMode="numeric" value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))} data-testid="input-event-capacity" />
            </label>
            <label className="field">
              <span>테이블 수 <em>· 1~50</em></span>
              <input type="number" min={1} max={50} inputMode="numeric" value={form.tableCount} onChange={(e) => set('tableCount', Number(e.target.value))} data-testid="input-event-tableCount" />
            </label>
          </div>
        </section>
        </>)}

        {status && <p className={status.kind === 'ok' ? 'notice' : 'error'} role="status" data-testid="status-admin-save">{status.kind === 'ok' && <Check size={16} />} {status.text}</p>}
        <button className="btn btn-primary sticky-save" type="submit" disabled={updateEvent.isPending} data-testid="button-save-event">{updateEvent.isPending ? '저장 중…' : '저장하기'}</button>
      </form>

    </>
  );
}

type AdminTab = 'reservations' | 'tables' | 'settings';

function initialTab(): AdminTab {
  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab === 'settings' || tab === 'tables' ? tab : 'reservations';
}

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(hasAdminSession);
  const [preview, setPreview] = useState<LookPreview | null>(null);
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const queryClient = useQueryClient();
  const eventQuery = useGetEvent({ query: { queryKey: getGetEventQueryKey() } });
  const updateEvent = useUpdateEvent();
  useTheme(preview ?? eventQuery.data);
  useCardStyle(preview?.cardStyle ?? eventQuery.data?.cardStyle);
  useDocumentTitle(eventQuery.data && `RSVP 관리자 · ${eventQuery.data.title}`);

  function selectTab(next: AdminTab) {
    setTab(next);
    // Leaving the editor drops any unsaved look preview.
    if (next !== 'settings') setPreview(null);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url);
  }

  // The seating board adds tables in tens; everything else about the event stays as it is.
  function changeTableCount(next: number) {
    const event = eventQuery.data;
    if (!event) return;
    updateEvent.mutate(
      { data: { ...toInput(event), tableCount: next } },
      {
        onSuccess: (saved) => queryClient.setQueryData(getGetEventQueryKey(), saved),
        onError: (error) => {
          if (isUnauthorized(error)) signOut();
        },
      },
    );
  }

  const signOut = useCallback(() => {
    clearAdminToken();
    setPreview(null);
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
      <button type="button" role="tab" aria-selected={tab === 'reservations'} className={tab === 'reservations' ? 'on' : ''} onClick={() => selectTab('reservations')} data-testid="tab-reservations"><ClipboardList size={17} />  현황</button>
      <button type="button" role="tab" aria-selected={tab === 'tables'} className={tab === 'tables' ? 'on' : ''} onClick={() => selectTab('tables')} data-testid="tab-tables"><Grid3x3 size={17} /> 테이블</button>
      <button type="button" role="tab" aria-selected={tab === 'settings'} className={tab === 'settings' ? 'on' : ''} onClick={() => selectTab('settings')} data-testid="tab-settings"><ImageUp size={17} /> 초대장</button>
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
            isFamilyType={eventQuery.data?.isFamilyType ?? true}
            eventTitle={eventQuery.data?.title ?? 'RSVP'}
            teamLabel={eventQuery.data?.belongTeamLabel.trim() || '소속'}
            deptLabel={eventQuery.data?.belongDeptLabel.trim() || '소속 부서'}
            deptOptions={eventQuery.data?.belongDeptOptions ?? []}
            tableCount={eventQuery.data?.tableCount ?? 20}
            messageLabel={eventQuery.data?.messageLabel.trim() || '메시지'}
          />
        ) : tab === 'tables' ? (
          <AdminTables
            tabs={tabs}
            onSignedOut={signOut}
            isFamilyType={eventQuery.data?.isFamilyType ?? true}
            teamLabel={eventQuery.data?.belongTeamLabel.trim() || '소속'}
            eventTitle={eventQuery.data?.title ?? 'RSVP'}
            deptOptions={eventQuery.data?.belongDeptOptions ?? []}
            tableCount={eventQuery.data?.tableCount ?? 20}
            onChangeTableCount={changeTableCount}
          />
        ) : (
          <>
            <div className="tabs-row">{tabs}</div>
            <article className="card admin-card">
              <EventEditor onSignedOut={signOut} onPreview={setPreview} />
            </article>
          </>
        )}
      </div>
    </main>
  );
}
