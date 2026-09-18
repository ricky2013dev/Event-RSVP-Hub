import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Baby, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  getGetRsvpConfirmationQueryKey,
  getGetRsvpSummaryQueryKey,
  useCreateRsvp,
  type Event,
} from '@workspace/api-client-react';
import { Flourish } from '@/components/ornaments';
import { FamilyDetails, formatPhone, labelsFor, RuledLabel, TotalBar } from '@/components/rsvp-parts';
import { RsvpShell } from '@/components/rsvp-shell';

type ChildRow = { key: string; name: string; age: string };

const MAX_CHILDREN = 10;
const newChildRow = (): ChildRow => ({ key: Math.random().toString(36).slice(2), name: '', age: '' });

function RsvpForm({ event }: { event: Event }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const createRsvp = useCreateRsvp();
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [belongTeam, setBelongTeam] = useState('');
  const [message, setMessage] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const labels = labelsFor(event);
  const { teamLabel, messageLabel } = labels;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // Only fully-filled child rows count, matching what the server stores.
  const completeChildren = useMemo(
    () => children.filter((c) => c.name.trim() && c.age.trim()).map((c) => ({ name: c.name.trim(), age: Number(c.age) })),
    [children],
  );
  const adultCount = (fatherName.trim() ? 1 : 0) + (motherName.trim() ? 1 : 0);

  function updateChild(key: string, patch: Partial<ChildRow>) {
    setChildren((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function review() {
    const next: Record<string, string> = {};
    if (!fatherName.trim() && !motherName.trim()) next.parents = '아빠 또는 엄마 이름 중 최소 한 분은 입력해 주세요.';
    children.forEach((child, index) => {
      const name = child.name.trim();
      const age = child.age.trim();
      if (!name && !age) next[child.key] = '아이 이름과 나이를 입력하거나 이 칸을 삭제해 주세요.';
      else if (!name) next[child.key] = `${index + 1}번째 아이의 이름을 입력해 주세요.`;
      else if (!age) next[child.key] = `${name}의 나이를 입력해 주세요.`;
      else if (!Number.isInteger(Number(age)) || Number(age) < 0 || Number(age) > 30) next[child.key] = '나이는 0살에서 30살 사이로 입력해 주세요.';
    });
    setErrors(next);
    setSubmitError('');
    if (Object.keys(next).length === 0) setStep('confirm');
  }

  function submit() {
    createRsvp.mutate(
      {
        data: {
          fatherName: fatherName.trim(),
          motherName: motherName.trim(),
          phoneNumber: phoneNumber.trim() || null,
          belongTeam: (teamLabel && belongTeam.trim()) || null,
          children: completeChildren,
          message: (messageLabel && message.trim()) || null,
        },
      },
      {
        onSuccess: (family) => {
          void queryClient.invalidateQueries({ queryKey: getGetRsvpSummaryQueryKey() });
          queryClient.setQueryData(getGetRsvpConfirmationQueryKey(family.confirmToken), family);
          navigate(`/rsvp/complete?token=${family.confirmToken}`);
        },
        onError: () => {
          setSubmitError('RSVP 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
          setStep('form');
        },
      },
    );
  }

  if (step === 'confirm') {
    return (
      <div className="panel">
        <div className="panel-head">
          <h1>입력하신 내용을 확인해 주세요</h1>
          <p>아래 내용으로 참석을 등록합니다.</p>
          <Flourish />
        </div>
        <FamilyDetails
          labels={labels}
          family={{ fatherName: fatherName.trim(), motherName: motherName.trim(), phone: phoneNumber.trim(), belongTeam: teamLabel ? belongTeam.trim() : null, children: completeChildren, message: messageLabel ? message.trim() : null }}
        />
        <TotalBar adults={adultCount} children={completeChildren.length} testId="text-confirm-total" />
        {submitError && <p className="error" role="alert">{submitError}</p>}
        <button className="btn btn-primary" type="button" onClick={submit} disabled={createRsvp.isPending} data-testid="button-submit-rsvp">{createRsvp.isPending ? '등록 중…' : 'RSVP 제출하기'}</button>
        <button className="btn btn-ghost" type="button" onClick={() => setStep('form')} disabled={createRsvp.isPending} data-testid="button-edit-form"><Pencil size={15} /> 다시 수정하기</button>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>참석 정보 입력</h1>
        <p>함께 오시는 가족분들을 적어주시면 자리를 준비하겠습니다.</p>
        <Flourish />
      </div>

      <section className="form-section">
        <RuledLabel>가족 대표 정보</RuledLabel>
        <div className="two-col">
          <label className="field"><span>아빠 이름</span><input value={fatherName} onChange={(e) => { setFatherName(e.target.value); setErrors((x) => ({ ...x, parents: '' })); }} placeholder="홍길동" data-testid="input-father-name" /></label>
          <label className="field"><span>엄마 이름</span><input value={motherName} onChange={(e) => { setMotherName(e.target.value); setErrors((x) => ({ ...x, parents: '' })); }} placeholder="김영희" data-testid="input-mother-name" /></label>
        </div>
        {errors.parents && <p className="field-error">{errors.parents}</p>}
        <label className="field"><span>연락처 <em>(선택)</em></span><input type="tel" inputMode="tel" autoComplete="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(formatPhone(e.target.value))} placeholder="972-555-0123" data-testid="input-phone" /></label>
        {teamLabel && (
          <label className="field"><span>{teamLabel} <em>(선택)</em></span><input value={belongTeam} maxLength={50} onChange={(e) => setBelongTeam(e.target.value)} data-testid="input-belong-team" /></label>
        )}
      </section>

      <section className="form-section">
        <RuledLabel aside={`${children.length}명`}>자녀 정보</RuledLabel>
        {children.length === 0 ? (
          <p className="hint-box">함께 오는 자녀가 있다면 아래 버튼으로 추가해 주세요.</p>
        ) : (
          children.map((child, index) => (
            <div className="child-row" key={child.key}>
              <div className="child-row-head">
                <span><Baby size={16} /> 자녀 {index + 1}</span>
                <button type="button" className="remove" onClick={() => setChildren((rows) => rows.filter((row) => row.key !== child.key))} data-testid={`button-remove-child-${index}`}><Trash2 size={14} /> 삭제</button>
              </div>
              <div className="child-cols">
                <label className="field"><span>아이 이름</span><input value={child.name} onChange={(e) => updateChild(child.key, { name: e.target.value })} placeholder="홍민수" data-testid={`input-child-name-${index}`} /></label>
                <label className="field"><span>나이</span><input type="number" inputMode="numeric" min={0} max={30} value={child.age} onChange={(e) => updateChild(child.key, { age: e.target.value })} placeholder="7" data-testid={`input-child-age-${index}`} /></label>
              </div>
              {errors[child.key] && <p className="field-error">{errors[child.key]}</p>}
            </div>
          ))
        )}
        {children.length < MAX_CHILDREN && (
          <button type="button" className="btn btn-dashed" onClick={() => setChildren((rows) => [...rows, newChildRow()])} data-testid="button-add-child"><Plus size={16} /> 자녀 추가</button>
        )}
      </section>

      {messageLabel && (
        <section className="form-section">
          <RuledLabel>{messageLabel} (선택)</RuledLabel>
          <label className="field"><span className="sr-only">{messageLabel}</span><textarea rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={event.messagePlaceholder} data-testid="input-message" /></label>
        </section>
      )}

      <TotalBar adults={adultCount} children={completeChildren.length} testId="text-total-members" />
      {submitError && <p className="error" role="alert">{submitError}</p>}
      <button className="btn btn-primary" type="button" onClick={review} data-testid="button-review-rsvp">입력 내용 확인하기</button>
    </div>
  );
}

export default function RsvpNewPage() {
  return <RsvpShell>{(event) => <RsvpForm event={event} />}</RsvpShell>;
}
