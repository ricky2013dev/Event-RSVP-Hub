import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { ApiError, useCreateRsvp, useUpdateRsvp, type ChildGroup, type ChoiceOption, type Rsvp } from '@workspace/api-client-react';
import { formatPhone } from '@/components/rsvp-parts';
import { childRowFrom, groupLabel, newChildRow, toChild, type ChildRow } from '@/lib/child-groups';

const MAX_CHILDREN = 10;

// Families the admin types in never filled the form themselves, so the note says where the entry came from.
export const ADMIN_NOTE = '관리자 등록';

export type EditorLabels = { isFamilyType: boolean; teamLabel: string; deptLabel: string; deptOptions: ChoiceOption[]; messageLabel: string; childGroups: ChildGroup[] };

type Props = {
  // null opens the editor empty, to register a family that never sent an RSVP.
  rsvp: Rsvp | null;
  labels: EditorLabels;
  onClose: () => void;
  onSaved: () => void;
  onSignedOut: () => void;
};

export function AdminRsvpEditor({ rsvp, labels, onClose, onSaved, onSignedOut }: Props) {
  const createRsvp = useCreateRsvp();
  const updateRsvp = useUpdateRsvp();
  const [fatherName, setFatherName] = useState(rsvp?.fatherName ?? '');
  const [motherName, setMotherName] = useState(rsvp?.motherName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(rsvp?.phoneNumber ?? '');
  const [belongDept, setBelongDept] = useState(rsvp?.belongDept ?? '');
  const [belongTeam, setBelongTeam] = useState(rsvp?.belongTeam ?? '');
  const [message, setMessage] = useState(rsvp?.message ?? '');
  const [children, setChildren] = useState<ChildRow[]>((rsvp?.children ?? []).map(childRowFrom));
  const [error, setError] = useState('');

  const creating = rsvp === null;
  const saving = creating ? createRsvp.isPending : updateRsvp.isPending;
  const deptAsText = labels.deptOptions.length === 0;
  const { isFamilyType } = labels;

  function updateChild(key: string, change: (row: ChildRow) => ChildRow) {
    setChildren((rows) => rows.map((row) => (row.key === key ? change(row) : row)));
  }

  function save(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!fatherName.trim() && !motherName.trim()) return setError(isFamilyType ? '아빠 또는 엄마 이름 중 최소 한 분은 입력해 주세요.' : '이름을 입력해 주세요.');
    if (isFamilyType) {
      if (children.some((child) => !child.name.trim())) return setError('자녀의 이름을 입력하거나 그 칸을 삭제해 주세요.');
      // Older children have no group, and a renamed group no longer matches, so both need picking again.
      const groupNames = new Set(labels.childGroups.map((group) => group.name));
      if (groupNames.size > 0 && children.some((child) => !groupNames.has(child.group))) return setError('자녀마다 그룹을 선택해 주세요.');
    }

    setError('');
    const note = message.trim();
    const data = {
      fatherName: fatherName.trim(),
      motherName: isFamilyType ? motherName.trim() : '',
      phoneNumber: phoneNumber.trim() || null,
      belongDept: belongDept.trim() || null,
      belongTeam: belongTeam.trim() || null,
      children: isFamilyType ? children.map((child) => toChild(child)) : [],
      message: creating ? [note, ADMIN_NOTE].filter(Boolean).join(' · ').slice(0, 500) : note || null,
    };
    const onError = (saveError: unknown) => {
      if (saveError instanceof ApiError && saveError.status === 401) return onSignedOut();
      setError(creating ? '추가하지 못했어요. 입력값을 확인해 주세요.' : '저장하지 못했어요. 입력값을 확인해 주세요.');
    };

    if (creating) createRsvp.mutate({ data }, { onSuccess: onSaved, onError });
    else updateRsvp.mutate({ id: rsvp.id, data }, { onSuccess: onSaved, onError });
  }

  const title = creating ? (isFamilyType ? '가족 직접 추가' : '참석자 직접 추가') : '예약 수정';

  return (
    <div className="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label={title}>
      <form className="modal-card" onSubmit={save} noValidate>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="닫기" data-testid="button-close-editor"><X size={18} /></button>
        </header>

        <div className="modal-body">
          {creating && <p className="admin-muted">RSVP를 보내지 않은 {isFamilyType ? '가족' : '분'}을 대신 등록해요. {labels.messageLabel || '메시지'}에 “{ADMIN_NOTE}”이 함께 남아요.</p>}
          {isFamilyType ? (
            <div className="admin-row">
              <label className="field"><span>아빠 이름</span><input value={fatherName} onChange={(e) => setFatherName(e.target.value)} data-testid="input-edit-father" /></label>
              <label className="field"><span>엄마 이름</span><input value={motherName} onChange={(e) => setMotherName(e.target.value)} data-testid="input-edit-mother" /></label>
            </div>
          ) : (
            <label className="field"><span>이름</span><input value={fatherName} onChange={(e) => setFatherName(e.target.value)} data-testid="input-edit-father" /></label>
          )}
          <label className="field"><span>연락처</span><input type="tel" inputMode="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(formatPhone(e.target.value))} data-testid="input-edit-phone" /></label>

          {labels.deptLabel && (deptAsText ? (
            <label className="field"><span>{labels.deptLabel}</span><input value={belongDept} maxLength={50} onChange={(e) => setBelongDept(e.target.value)} data-testid="input-edit-dept" /></label>
          ) : (
            <fieldset className="field choice-field">
              <legend>{labels.deptLabel}</legend>
              <div className="choices">
                {labels.deptOptions.map((option) => (
                  <label className={`choice ${belongDept === option.value ? 'on' : ''}`} key={option.value}>
                    <input type="radio" name="edit-belong-dept" value={option.value} checked={belongDept === option.value} onChange={() => setBelongDept(option.value)} data-testid={`radio-edit-dept-${option.value}`} />
                    {option.label}
                  </label>
                ))}
                {belongDept && <button type="button" className="remove" onClick={() => setBelongDept('')} data-testid="button-clear-edit-dept">선택 해제</button>}
              </div>
            </fieldset>
          ))}

          {labels.teamLabel && (
            <label className="field"><span>{labels.teamLabel}</span><input value={belongTeam} maxLength={50} onChange={(e) => setBelongTeam(e.target.value)} data-testid="input-edit-team" /></label>
          )}

          {isFamilyType && (
          <div className="field">
            <span>자녀 <em>{children.length}명</em></span>
            {children.map((child, index) => (
              <div className="option-row" key={child.key}>
                <input value={child.name} maxLength={50} placeholder="이름" onChange={(e) => updateChild(child.key, (row) => ({ ...row, name: e.target.value }))} data-testid={`input-edit-child-name-${index}`} />
                {labels.childGroups.length > 0 && (
                  <select value={child.group} onChange={(e) => updateChild(child.key, (row) => ({ ...row, group: e.target.value }))} data-testid={`select-edit-child-group-${index}`}>
                    <option value="" disabled>{child.age != null ? `그룹 선택 (${child.age}살)` : '그룹 선택'}</option>
                    {labels.childGroups.map((group) => <option key={group.name} value={group.name}>{groupLabel(group, (min, max) => `${min}–${max}살`)}</option>)}
                  </select>
                )}
                <button type="button" className="remove" onClick={() => setChildren((rows) => rows.filter((row) => row.key !== child.key))} data-testid={`button-remove-edit-child-${index}`}><Trash2 size={14} /> 삭제</button>
              </div>
            ))}
            {children.length < MAX_CHILDREN && (
              <button type="button" className="btn btn-dashed" onClick={() => setChildren((rows) => [...rows, newChildRow()])} data-testid="button-add-edit-child"><Plus size={16} /> 자녀 추가</button>
            )}
          </div>
          )}

          {labels.messageLabel && (
            <label className="field"><span>{labels.messageLabel}</span><textarea rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} data-testid="input-edit-message" /></label>
          )}

          {error && <p className="error" role="alert" data-testid="status-edit-error">{error}</p>}
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn-outline" onClick={onClose} data-testid="button-cancel-edit">취소</button>
          <button type="submit" className="btn btn-primary" disabled={saving} data-testid="button-save-edit">{saving ? (creating ? '추가 중…' : '저장 중…') : (creating ? '추가하기' : '저장하기')}</button>
        </footer>
      </form>
    </div>
  );
}
