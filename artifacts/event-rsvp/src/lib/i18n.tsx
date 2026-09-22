import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// The guest pages read in Korean by default and can be switched to English. The admin
// pages are Korean only, so nothing under /admin uses any of this.
export type Lang = 'en' | 'ko';

const STORAGE_KEY = 'rsvp-lang';

function storedLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ko';
  } catch {
    // Private windows and blocked site data throw here; Korean is the default anyway.
    return 'ko';
  }
}

const EN = {
  // Shell and shared
  back: 'Back to invitation',
  loading: 'Loading…',
  pageError: 'We could not load this page.',
  tryAgain: 'Try again',

  // Invitation
  invitationError: 'We could not load the invitation.',
  date: 'Date',
  time: 'Time',
  venue: 'Venue',
  mapLink: 'View on map',
  dressCode: 'Dress code',
  openRsvp: 'RSVP',
  openLookup: 'Find my RSVP',
  statsCaption: 'Here is who has replied so far',
  statFamilies: 'Families',
  statTotal: 'Total attending',
  statAdultsChildren: 'Adults / Children',
  unitFamilies: 'families',
  unitPeople: 'people',
  privacyNote1: 'Your details are used only for this RSVP',
  privacyNote2: 'and are safely deleted after the event.',
  admin: 'Admin',

  // RSVP form
  formTitle: 'Tell us who is coming',
  sectionFamily: 'Family contact',
  sectionGuest: 'Your details',
  fatherName: 'Father’s name',
  motherName: 'Mother’s name',
  fatherPlaceholder: 'John Doe',
  motherPlaceholder: 'Jane Doe',
  // Shown in place of the parents when the event is not a family one.
  guestName: 'Name',
  guestPlaceholder: 'John Doe',
  phone: 'Phone',
  optional: '(optional)',
  sectionChildren: 'Children',
  childCount: (n: number) => (n === 1 ? '1 child' : `${n} children`),
  childrenEmpty: 'Add a row for each child coming with you.',
  childN: (n: number) => `Child ${n}`,
  remove: 'Remove',
  childName: 'Child’s name',
  childAge: 'Age',
  childNamePlaceholder: 'Alex Doe',
  addChild: 'Add a child',
  review: 'Review your details',
  confirmTitle: 'Check your details, then submit',
  confirmLead: 'Your family is registered once you press submit.',
  confirmLeadGuest: 'You are registered once you press submit.',
  submitting: 'Submitting…',
  submit: 'Submit RSVP',
  editAgain: 'Edit again',
  errParents: 'Please enter at least one parent’s name.',
  errName: 'Please enter your name.',
  errChoose: (label: string) => `Please choose a ${label}.`,
  errChildBlank: 'Enter this child’s name and age, or remove the row.',
  errChildName: (n: number) => `Please enter child ${n}’s name.`,
  errChildAge: (name: string) => `Please enter ${name}’s age.`,
  errChildAgeRange: 'Age must be between 0 and 30.',
  errSubmit: 'We could not save your RSVP. Please try again in a moment.',

  // Family details and totals
  father: 'Father',
  mother: 'Mother',
  guest: 'Name',
  deptFallback: 'Group',
  teamFallback: 'Team',
  table: 'Table',
  tableNo: (n: number) => `#${n}`,
  childrenLabel: 'Children',
  none: 'None',
  childWithAge: (name: string, age: number) => `${name} (${age})`,
  messageFallback: 'Message',
  totalAttending: 'Total attending',
  adultsChildren: (adults: number, children: number) => `Adults ${adults} · Children ${children}`,
  totalPeople: (n: number) => `${n}`,

  // Lookup
  lookupTitle: 'Find your RSVP',
  lookupLead: 'Enter a name from your RSVP, or the last digits of the phone number you gave.',
  lookupField: 'Name or last digits of phone',
  lookupPlaceholder: 'John Doe or 1234',
  searching: 'Searching…',
  search: 'Search',
  errLookupEmpty: 'Enter a family member’s name or the last digits of your phone number.',
  errLookupDigits: 'Enter at least the last 4 digits of the phone number.',
  errLookupThrottled: 'Too many lookups. Please try again in a moment.',
  errLookupFailed: 'We could not run the lookup. Please try again in a moment.',
  lookupNone: (term: string) => `Nothing found for “${term}”.`,
  lookupToNew: 'Register instead',
  lookupFound: (n: number) => (n === 1 ? 'Found 1 RSVP.' : `Found ${n} RSVPs.`),
  lookupOpen: 'View details',
  // Shown instead of the search box when the event publishes its whole guest list.
  lookupListLead: 'Find your name in the list below, or type to narrow it down.',
  lookupFilterField: 'Filter the list by name',
  lookupFilterPlaceholder: 'Type a name to filter',
  lookupListCount: (n: number) => (n === 1 ? '1 RSVP' : `${n} RSVPs`),
  lookupListEmpty: 'Nobody has replied yet.',

  // Confirmation
  // Shown on every RSVP page, and in place of the invitation's buttons, once the admin closes RSVPs.
  closedTitle: 'RSVPs are closed',
  closedLead: 'We are no longer taking RSVPs. Thank you for your interest.',

  notFoundTitle: 'We could not find that RSVP',
  notFoundLead: 'Check that the link is right, or look it up by name.',
  confirmedLookup: 'Your RSVP is confirmed.',
  confirmedNew: 'Your RSVP is complete.',
  seeYouAt: (title: string) => `See you at ${title}!`,
  loadingDetails: 'Loading your details…',
  registeredAs: 'This is what we have on file.',
  saveLink1: 'Save this page’s link and you can check',
  saveLink2: 'your RSVP again at any time.',
  copied: 'Link copied',
  copyLink: 'Copy this page’s link',
};

// Typing the Korean copy as the English one keeps the two in step: a key added to EN
// without a Korean translation fails the build.
const KO: typeof EN = {
  back: '초대장으로',
  loading: '불러오는 중…',
  pageError: '페이지를 불러오지 못했어요.',
  tryAgain: '다시 시도',

  invitationError: '초대장을 불러오지 못했어요.',
  date: '날짜',
  time: '시간',
  venue: '장소',
  mapLink: '지도에서 보기',
  dressCode: '복장',
  openRsvp: '참석 RSVP',
  openLookup: '기존 예약 확인하기',
  statsCaption: '지금까지 알려주신 참석 현황이에요',
  statFamilies: '등록 가족',
  statTotal: '총 참석 예정 인원',
  statAdultsChildren: '어른 / 자녀',
  unitFamilies: '가족',
  unitPeople: '명',
  privacyNote1: '입력하신 정보는 RSVP 목적으로만 사용되며',
  privacyNote2: '행사 종료 후 안전하게 폐기됩니다.',
  admin: '관리자',

  formTitle: '참석 정보 입력',
  sectionFamily: '가족 대표 정보',
  sectionGuest: '참석자 정보',
  fatherName: '아빠 이름',
  motherName: '엄마 이름',
  fatherPlaceholder: '홍길동',
  motherPlaceholder: '김영희',
  guestName: '이름',
  guestPlaceholder: '홍길동',
  phone: '연락처',
  optional: '(옵션사항)',
  sectionChildren: '자녀 정보',
  childCount: (n: number) => `${n}명`,
  childrenEmpty: '자녀가 있다면  추가.',
  childN: (n: number) => `자녀 ${n}`,
  remove: '삭제',
  childName: '아이 이름',
  childAge: '나이',
  childNamePlaceholder: '홍민수',
  addChild: '자녀 추가',
  review: '입력 내용 확인하기',
  confirmTitle: '내용확인후 제출하기를 클릭해 주세요',
  confirmLead: '제출하기 버튼을 클릭하시면 등록됩니다.',
  confirmLeadGuest: '제출하기 버튼을 클릭하시면 등록됩니다.',
  submitting: '등록 중…',
  submit: 'RSVP 제출하기',
  editAgain: '다시 수정하기',
  errParents: '아빠 또는 엄마 이름 중 최소 한 분은 입력해 주세요.',
  errName: '이름을 입력해 주세요.',
  errChoose: (label: string) => `${label}을(를) 선택해 주세요.`,
  errChildBlank: '아이 이름과 나이를 입력하거나 이 칸을 삭제해 주세요.',
  errChildName: (n: number) => `${n}번째 아이의 이름을 입력해 주세요.`,
  errChildAge: (name: string) => `${name}의 나이를 입력해 주세요.`,
  errChildAgeRange: '나이는 0살에서 30살 사이로 입력해 주세요.',
  errSubmit: 'RSVP 등록에 실패했어요. 잠시 후 다시 시도해 주세요.',

  father: '아빠',
  mother: '엄마',
  guest: '이름',
  deptFallback: '소속 부서',
  teamFallback: '소속',
  table: '테이블',
  tableNo: (n: number) => `${n}번`,
  childrenLabel: '자녀',
  none: '없음',
  childWithAge: (name: string, age: number) => `${name} (${age}살)`,
  messageFallback: '메시지',
  totalAttending: '총 참석 인원',
  adultsChildren: (adults: number, children: number) => `어른 ${adults} · 자녀 ${children}`,
  totalPeople: (n: number) => `${n}명`,

  lookupTitle: '기존 예약 확인',
  lookupLead: '등록하실 때 적은 가족 중 한 분의 이름이나 전화번호 뒷자리를 입력해 주세요.',
  lookupField: '이름 또는 전화번호 뒷자리',
  lookupPlaceholder: '홍길동 또는 1234',
  searching: '조회 중…',
  search: '조회',
  errLookupEmpty: '가족 중 한 분의 이름이나 전화번호 뒷자리를 입력해 주세요.',
  errLookupDigits: '전화번호는 뒤 4자리 이상 입력해 주세요.',
  errLookupThrottled: '조회 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
  errLookupFailed: '조회하지 못했어요. 잠시 후 다시 시도해 주세요.',
  lookupNone: (term: string) => `‘${term}’(으)로 등록된 내역이 없어요.`,
  lookupToNew: '새로 등록하기',
  lookupFound: (n: number) => `${n}건을 찾았어요.`,
  lookupOpen: '등록 내용 보기',
  lookupListLead: '아래 명단에서 본인 이름을 찾아 눌러주세요. 이름을 입력하면 명단이 걸러져요.',
  lookupFilterField: '이름으로 명단 걸러보기',
  lookupFilterPlaceholder: '이름 입력',
  lookupListCount: (n: number) => `${n}건`,
  lookupListEmpty: '아직 등록된 내역이 없어요.',

  closedTitle: 'RSVP가 마감되었어요',
  closedLead: '더 이상 RSVP를 받지 않아요. 관심 가져주셔서 감사합니다.',

  notFoundTitle: '등록 내용을 찾을 수 없어요',
  notFoundLead: '주소가 올바른지 확인하시거나 이름으로 다시 조회해 주세요.',
  confirmedLookup: '참석 등록이 확인되었습니다.',
  confirmedNew: 'RSVP 등록이 완료되었습니다.',
  seeYouAt: (title: string) => `${title}에서 뵙겠습니다!`,
  loadingDetails: '등록 정보를 불러오는 중…',
  registeredAs: '아래 내용으로 등록되어 있습니다.',
  saveLink1: '이 페이지 주소를 저장해 두시면',
  saveLink2: '언제든 등록 내용을 다시 확인하실 수 있습니다.',
  copied: '주소를 복사했어요',
  copyLink: '이 페이지 주소 복사',
};

const COPY: Record<Lang, typeof EN> = { en: EN, ko: KO };

// The locale the invitation's date and time are written in.
export const LOCALE: Record<Lang, string> = { en: 'en-US', ko: 'ko-KR' };

type LangValue = { lang: Lang; setLang: (lang: Lang) => void; t: typeof EN };

const LangContext = createContext<LangValue>({ lang: 'ko', setLang: () => {}, t: KO });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang);

  useEffect(() => {
    document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A guest who cannot store the choice still gets it for this visit.
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: COPY[lang] }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  return useContext(LangContext);
}

// Regional-indicator pairs. A platform without flag glyphs (Windows) falls back to
// drawing the letters themselves — "US" and "KR" — which still reads correctly.
const SWITCH: { id: Lang; flag: string; name: string }[] = [
  { id: 'en', flag: '\u{1F1FA}\u{1F1F8}', name: 'English' },
  { id: 'ko', flag: '\u{1F1F0}\u{1F1F7}', name: '한국어' },
];

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {SWITCH.map(({ id, flag, name }) => (
        <button
          key={id}
          type="button"
          aria-pressed={lang === id}
          aria-label={name}
          title={name}
          className={lang === id ? 'on' : ''}
          onClick={() => setLang(id)}
          data-testid={`button-lang-${id}`}
        >
          {flag}
        </button>
      ))}
    </div>
  );
}
