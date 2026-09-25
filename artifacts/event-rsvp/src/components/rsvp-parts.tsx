import { Users } from 'lucide-react';
import type { ChildGroup, ChoiceOption, RsvpChild } from '@workspace/api-client-react';
import { childDetail } from '@/lib/child-groups';
import { useLang } from '@/lib/i18n';

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

export type FieldLabels = { isFamilyType: boolean; teamLabel: string; deptLabel: string; deptOptions: ChoiceOption[]; messageLabel: string; childGroups: ChildGroup[] };

export function labelsFor(event: { isFamilyType: boolean; belongTeamLabel: string; belongDeptLabel: string; belongDeptOptions: ChoiceOption[]; messageLabel: string; childGroups: ChildGroup[] }): FieldLabels {
  return {
    isFamilyType: event.isFamilyType,
    childGroups: event.childGroups,
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
  const { t } = useLang();
  return (
    <dl className="family">
      {family.fatherName && <div><dt>{labels.isFamilyType ? t.father : t.guest}</dt><dd>{family.fatherName}</dd></div>}
      {labels.isFamilyType && family.motherName && <div><dt>{t.mother}</dt><dd>{family.motherName}</dd></div>}
      {family.phone && <div><dt>{t.phone}</dt><dd>{family.phone}</dd></div>}
      {family.belongDept && <div><dt>{labels.deptLabel || t.deptFallback}</dt><dd>{optionLabel(labels.deptOptions, family.belongDept)}</dd></div>}
      {family.belongTeam && <div><dt>{labels.teamLabel || t.teamFallback}</dt><dd>{family.belongTeam}</dd></div>}
      {family.tableNumber != null && <div><dt>{t.table}</dt><dd data-testid="text-table-number">{t.tableNo(family.tableNumber)}</dd></div>}
      {labels.isFamilyType && <div><dt>{t.childrenLabel}</dt><dd>{family.children.length === 0 ? t.none : family.children.map((child) => t.childWith(child.name, childDetail(child, t.years))).join('\n')}</dd></div>}
      {family.message && <div><dt>{labels.messageLabel || t.messageFallback}</dt><dd>{family.message}</dd></div>}
    </dl>
  );
}

// Outside a family event nobody brings children, so the adults/children split is left off.
export function TotalBar({ adults, children, isFamilyType = true, testId }: { adults: number; children: number; isFamilyType?: boolean; testId: string }) {
  const { t } = useLang();
  return (
    <div className="total-bar">
      <span className="total-label"><Users size={16} /> {t.totalAttending}</span>
      <span className="total-value">
        {isFamilyType && <small>{t.adultsChildren(adults, children)}</small>}
        <strong data-testid={testId}>{t.totalPeople(adults + children)}</strong>
      </span>
    </div>
  );
}
