import type { RsvpChild } from '@workspace/api-client-react';

// A child row as typed: a name and the name of the group picked for it. A child saved
// before groups existed keeps its age in `age`, so the admin can see it while picking.
export type ChildRow = { key: string; name: string; group: string; age?: number };

export const newChildKey = () => Math.random().toString(36).slice(2);

export const newChildRow = (): ChildRow => ({ key: newChildKey(), name: '', group: '' });

export function childRowFrom(child: RsvpChild): ChildRow {
  return { key: newChildKey(), name: child.name, group: child.group ?? '', age: child.age };
}

export function toChild(row: ChildRow): RsvpChild {
  return { name: row.name.trim(), group: row.group };
}

// What follows a saved child's name: its group, or the age older RSVPs were saved with.
export function childDetail(child: RsvpChild, years: (age: number) => string): string {
  if (child.group) return child.group;
  return child.age != null ? years(child.age) : '';
}
