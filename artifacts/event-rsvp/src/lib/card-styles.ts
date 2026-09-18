import { useEffect, useSyncExternalStore } from 'react';
import type { EventCardStyle } from '@workspace/api-client-react';

export type CornerKind = 'leaf' | 'rule' | 'confetti' | 'deco' | 'scroll';
export type FlourishKind = 'classic' | 'rule' | 'festive' | 'deco' | 'ornate';

export type CardStyle = {
  id: EventCardStyle;
  name: string;
  hint: string;
  corner: CornerKind;
  flourish: FlourishKind;
  /** Small glyphs floating around the photo; an empty list keeps the card plain. */
  sparkles: string[];
};

// Keep ids in sync with the EventCardStyle enum in lib/api-spec/openapi.yaml.
export const CARD_STYLES: CardStyle[] = [
  { id: 'classic', name: '클래식', hint: '잎사귀 장식의 기본 초대장', corner: 'leaf', flourish: 'classic', sparkles: ['✦', '✦', '✦'] },
  { id: 'dinner', name: '디너', hint: '각진 테두리의 담백한 식사 초대', corner: 'rule', flourish: 'rule', sparkles: [] },
  { id: 'birthday', name: '생일', hint: '둥글고 말랑한 점선 테두리', corner: 'confetti', flourish: 'festive', sparkles: ['✿', '✦', '✿'] },
  { id: 'party', name: '파티', hint: '둥근 사진과 알약 버튼의 경쾌한 카드', corner: 'confetti', flourish: 'festive', sparkles: ['✧', '★', '✧'] },
  { id: 'performance', name: '공연', hint: '티켓처럼 각진 프로그램 카드', corner: 'deco', flourish: 'deco', sparkles: ['♪', '♬', '♪'] },
  { id: 'ceremony', name: '예식 · 기념식', hint: '두 겹 금테의 격식 있는 카드', corner: 'scroll', flourish: 'ornate', sparkles: ['✦', '❖', '✦'] },
];

export function findCardStyle(id: string | undefined): CardStyle {
  return CARD_STYLES.find((style) => style.id === id) ?? CARD_STYLES[0];
}

// The shape goes on <html> so the CSS reaches every card at once. The corner and
// divider ornaments are SVG rather than CSS, so they subscribe here instead.
let current = CARD_STYLES[0];
const listeners = new Set<() => void>();

export function useCardStyle(id: string | undefined) {
  useEffect(() => {
    if (!id) return;
    const style = findCardStyle(id);
    document.documentElement.dataset.cardStyle = style.id;
    if (style === current) return;
    current = style;
    for (const listener of listeners) listener();
  }, [id]);
}

export function useCurrentCardStyle(): CardStyle {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}
