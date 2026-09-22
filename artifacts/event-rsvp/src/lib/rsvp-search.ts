import type { RsvpChild } from '@workspace/api-client-react';

// Admin rows carry the whole record; the public ones a guest filters have no display
// name and only the masked phone number, whose last 4 digits still match a search.
type Searchable = {
  fatherName: string;
  motherName: string;
  name?: string;
  belongTeam?: string | null;
  belongDept?: string | null;
  children: RsvpChild[];
  phoneNumber?: string | null;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, '');
}

// Two digits are enough to start narrowing the list, and the last 4 of a phone number always match.
const PHONE_MIN_DIGITS = 2;

// Matches parent names, child names, the department (stored value or shown label), the team,
// or any run of phone digits — dashes, spaces
// and parentheses in either the query or the stored number are ignored, so "9876",
// "555-9876" and "(214) 555 9876" all find the same family.
export function matchesSearch(rsvp: Searchable, query: string, deptDisplay = ''): boolean {
  const term = query.trim();
  if (!term) return true;

  const digits = term.replace(/\D/g, '');
  const phoneDigits = (rsvp.phoneNumber ?? '').replace(/\D/g, '');
  if (digits.length >= PHONE_MIN_DIGITS && phoneDigits.includes(digits)) return true;

  const text = normalize(term);
  const names = [rsvp.fatherName, rsvp.motherName, rsvp.name ?? '', rsvp.belongTeam ?? '', rsvp.belongDept ?? '', deptDisplay, ...rsvp.children.map((child) => child.name)];
  return names.some((name) => normalize(name).includes(text));
}
