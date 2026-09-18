import { Users } from 'lucide-react';
import type { ChoiceOption, RsvpChild } from '@workspace/api-client-react';

// US numbers read as 972-555-0123; a Korean mobile (010…) as 010-1234-5678.
export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.startsWith('010')) return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7)].filter(Boolean).join('-');
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join('-');
}

export function RuledLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="ruled">
      <span className="ruled-line" />
      <span className="ruled-text">{children}</span>
      <span className="ruled-line flip" />
      {aside && <span className="ruled-aside">{aside}</span>}
    </div>
  );
}

export type FamilySummary = {
  fatherName: string;
  motherName: string;
  phone?: string;
  belongTeam?: string | null;
  belongDept?: string | null;
  tableNumber?: number | null;
  children: RsvpChild[];
  message?: string | null;
};

export type FieldLabels = { teamLabel: string; deptLabel: string; deptOptions: ChoiceOption[]; messageLabel: string };

export function labelsFor(event: { belongTeamLabel: string; belongDeptLabel: string; belongDeptOptions: ChoiceOption[]; messageLabel: string }): FieldLabels {
  return {
    teamLabel: event.belongTeamLabel.trim(),
    deptLabel: event.belongDeptLabel.trim(),
    deptOptions: event.belongDeptOptions,
    messageLabel: event.messageLabel.trim(),
  };
}

// Admin-set labels can be long sentences; table headers keep 3 characters and hold the full text in a tooltip.
const HEADER_MAX = 3;
export function shortHeader(label: string): string {
  return label.length > HEADER_MAX ? `${label.slice(0, HEADER_MAX)}…` : label;
}

// Rows store the option's value; older free-text entries have no option and show as they were typed.
export function optionLabel(options: ChoiceOption[], value: string | null | undefined): string {
  if (!value) return '';
  return options.find((option) => option.value === value)?.label ?? value;
}

export function FamilyDetails({ family, labels }: { family: FamilySummary; labels: FieldLabels }) {
  return (
    <dl className="family">
      {family.fatherName && <div><dt>아빠</dt><dd>{family.fatherName}</dd></div>}
      {family.motherName && <div><dt>엄마</dt><dd>{family.motherName}</dd></div>}
      {family.phone && <div><dt>연락처</dt><dd>{family.phone}</dd></div>}
      {family.belongDept && <div><dt>{labels.deptLabel || '소속 부서'}</dt><dd>{optionLabel(labels.deptOptions, family.belongDept)}</dd></div>}
      {family.belongTeam && <div><dt>{labels.teamLabel || '소속'}</dt><dd>{family.belongTeam}</dd></div>}
      {family.tableNumber != null && <div><dt>테이블</dt><dd data-testid="text-table-number">{family.tableNumber}번</dd></div>}
      <div><dt>자녀</dt><dd>{family.children.length === 0 ? '없음' : family.children.map((child) => `${child.name} (${child.age}살)`).join('\n')}</dd></div>
      {family.message && <div><dt>{labels.messageLabel || '메시지'}</dt><dd>{family.message}</dd></div>}
    </dl>
  );
}

export function TotalBar({ adults, children, testId }: { adults: number; children: number; testId: string }) {
  return (
    <div className="total-bar">
      <span className="total-label"><Users size={16} /> 총 참석 인원</span>
      <span className="total-value">
        <small>어른 {adults} · 자녀 {children}</small>
        <strong data-testid={testId}>{adults + children}명</strong>
      </span>
    </div>
  );
}
