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
import { useLang } from '@/lib/i18n';

type ChildRow = { key: string; name: string; age: string };

const MAX_CHILDREN = 10;
const newChildRow = (): ChildRow => ({ key: Math.random().toString(36).slice(2), name: '', age: '' });

function RsvpForm({ event }: { event: Event }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const createRsvp = useCreateRsvp();
  const { t } = useLang();
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [belongTeam, setBelongTeam] = useState('');
  const [belongDept, setBelongDept] = useState(() => event.belongDeptOptions[0]?.value ?? '');
  const [message, setMessage] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const labels = labelsFor(event);
  const { isFamilyType, teamLabel, deptLabel, deptOptions, messageLabel } = labels;
  const deptAsText = Boolean(deptLabel) && deptOptions.length === 0;
  const deptRequired = Boolean(deptLabel) && deptOptions.length > 0;

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
    if (!fatherName.trim() && !motherName.trim()) next.parents = isFamilyType ? t.errParents : t.errName;
    if (deptRequired && !belongDept.trim()) next.belongDept = t.errChoose(deptLabel);
    if (isFamilyType) children.forEach((child, index) => {
      const name = child.name.trim();
      const age = child.age.trim();
      if (!name && !age) next[child.key] = t.errChildBlank;
      else if (!name) next[child.key] = t.errChildName(index + 1);
      else if (!age) next[child.key] = t.errChildAge(name);
      else if (!Number.isInteger(Number(age)) || Number(age) < 0 || Number(age) > 30) next[child.key] = t.errChildAgeRange;
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
          motherName: isFamilyType ? motherName.trim() : '',
          phoneNumber: phoneNumber.trim() || null,
          belongTeam: (teamLabel && belongTeam.trim()) || null,
          belongDept: (deptLabel && belongDept.trim()) || null,
          children: isFamilyType ? completeChildren : [],
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
          setSubmitError(t.errSubmit);
          setStep('form');
        },
      },
    );
  }

  if (step === 'confirm') {
    return (
      <div className="panel">
        <div className="panel-head">
          <h1>{t.confirmTitle}</h1>
          <p>{isFamilyType ? t.confirmLead : t.confirmLeadGuest}</p>
          <Flourish />
        </div>
        <FamilyDetails
          labels={labels}
          family={{ fatherName: fatherName.trim(), motherName: motherName.trim(), phone: phoneNumber.trim(), belongDept: deptLabel ? belongDept.trim() : null, belongTeam: teamLabel ? belongTeam.trim() : null, children: completeChildren, message: messageLabel ? message.trim() : null }}
        />
        <TotalBar adults={adultCount} children={completeChildren.length} isFamilyType={isFamilyType} testId="text-confirm-total" />
        {submitError && <p className="error" role="alert">{submitError}</p>}
        <button className="btn btn-primary" type="button" onClick={submit} disabled={createRsvp.isPending} data-testid="button-submit-rsvp">{createRsvp.isPending ? t.submitting : t.submit}</button>
        <button className="btn btn-ghost" type="button" onClick={() => setStep('form')} disabled={createRsvp.isPending} data-testid="button-edit-form"><Pencil size={15} /> {t.editAgain}</button>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>{t.formTitle}</h1>
        <Flourish />
      </div>

      <section className="form-section">
        <RuledLabel>{isFamilyType ? t.sectionFamily : t.sectionGuest}</RuledLabel>
        {/* A lone guest fills one name box, and it is stored as the father's name. */}
        {isFamilyType ? (
          <div className="two-col">
            <label className="field"><span>{t.fatherName}</span><input value={fatherName} onChange={(e) => { setFatherName(e.target.value); setErrors((x) => ({ ...x, parents: '' })); }} placeholder={t.fatherPlaceholder} data-testid="input-father-name" /></label>
            <label className="field"><span>{t.motherName}</span><input value={motherName} onChange={(e) => { setMotherName(e.target.value); setErrors((x) => ({ ...x, parents: '' })); }} placeholder={t.motherPlaceholder} data-testid="input-mother-name" /></label>
          </div>
        ) : (
          <label className="field"><span>{t.guestName}</span><input value={fatherName} onChange={(e) => { setFatherName(e.target.value); setErrors((x) => ({ ...x, parents: '' })); }} placeholder={t.guestPlaceholder} data-testid="input-father-name" /></label>
        )}
        {errors.parents && <p className="field-error">{errors.parents}</p>}
        <label className="field"><span>{t.phone} <em>{t.optional}</em></span><input type="tel" inputMode="tel" autoComplete="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(formatPhone(e.target.value))} placeholder="972-555-0123" data-testid="input-phone" /></label>
        {/* Choices need the full width; a plain text box still pairs up with the team field. */}
        {deptLabel && deptOptions.length > 0 && (
          <fieldset className="field choice-field">
            <legend>{deptLabel}</legend>
            <div className="choices">
              {deptOptions.map((option) => (
                <label className={`choice ${belongDept === option.value ? 'on' : ''}`} key={option.value}>
                  <input type="radio" name="belong-dept" value={option.value} checked={belongDept === option.value} onChange={() => { setBelongDept(option.value); setErrors((x) => ({ ...x, belongDept: '' })); }} data-testid={`radio-belong-dept-${option.value}`} />
                  {option.label}
                </label>
              ))}
            </div>
            {errors.belongDept && <p className="field-error">{errors.belongDept}</p>}
          </fieldset>
        )}
        {(deptAsText || teamLabel) && (
          <div className={deptAsText && teamLabel ? 'two-col' : undefined}>
            {deptAsText && (
              <label className="field"><span>{deptLabel} <em>{t.optional}</em></span><input value={belongDept} maxLength={50} onChange={(e) => setBelongDept(e.target.value)} data-testid="input-belong-dept" /></label>
            )}
            {teamLabel && (
              <label className="field"><span>{teamLabel} <em>{t.optional}</em></span><input value={belongTeam} maxLength={50} onChange={(e) => setBelongTeam(e.target.value)} data-testid="input-belong-team" /></label>
            )}
          </div>
        )}
      </section>

      {isFamilyType && (
      <section className="form-section">
        <RuledLabel aside={t.childCount(children.length)}>{t.sectionChildren}</RuledLabel>
        {children.length === 0 ? (
          <p className="hint-box">{t.childrenEmpty}</p>
        ) : (
          children.map((child, index) => (
            <div className="child-row" key={child.key}>
              <div className="child-row-head">
                <span><Baby size={16} /> {t.childN(index + 1)}</span>
                <button type="button" className="remove" onClick={() => setChildren((rows) => rows.filter((row) => row.key !== child.key))} data-testid={`button-remove-child-${index}`}><Trash2 size={14} /> {t.remove}</button>
              </div>
              <div className="child-cols">
                <label className="field"><span>{t.childName}</span><input value={child.name} onChange={(e) => updateChild(child.key, { name: e.target.value })} placeholder={t.childNamePlaceholder} data-testid={`input-child-name-${index}`} /></label>
                <label className="field"><span>{t.childAge}</span><input type="number" inputMode="numeric" min={0} max={30} value={child.age} onChange={(e) => updateChild(child.key, { age: e.target.value })} placeholder="7" data-testid={`input-child-age-${index}`} /></label>
              </div>
              {errors[child.key] && <p className="field-error">{errors[child.key]}</p>}
            </div>
          ))
        )}
        {children.length < MAX_CHILDREN && (
          <button type="button" className="btn btn-dashed" onClick={() => setChildren((rows) => [...rows, newChildRow()])} data-testid="button-add-child"><Plus size={16} /> {t.addChild}</button>
        )}
      </section>
      )}

      {messageLabel && (
        <section className="form-section">
          <RuledLabel>{messageLabel} {t.optional}</RuledLabel>
          <label className="field"><span className="sr-only">{messageLabel}</span><textarea rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={event.messagePlaceholder} data-testid="input-message" /></label>
        </section>
      )}

      <TotalBar adults={adultCount} children={completeChildren.length} isFamilyType={isFamilyType} testId="text-total-members" />
      {submitError && <p className="error" role="alert">{submitError}</p>}
      <button className="btn btn-primary" type="button" onClick={review} data-testid="button-review-rsvp">{t.review}</button>
    </div>
  );
}

export default function RsvpNewPage() {
  return <RsvpShell>{(event) => <RsvpForm event={event} />}</RsvpShell>;
}
