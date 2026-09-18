import { useEffect } from 'react';
import type { EventTheme } from '@workspace/api-client-react';

type Palette = {
  bg: string;
  bgGlow: string;
  card: string;
  ink: string;
  inkSoft: string;
  muted: string;
  gold: string;
  goldSoft: string;
  line: string;
  cream: string;
  tint: string;
  rose: string;
  roseDeep: string;
  roseSoft: string;
  shadow: string;
};

export type Theme = { id: EventTheme; name: string; colors: Palette };

// Keep ids in sync with the EventTheme enum in lib/api-spec/openapi.yaml.
export const THEMES: Theme[] = [
  {
    id: 'rose',
    name: '로즈 골드',
    colors: { bg: '#f7efe9', bgGlow: '#fbe7e4', card: '#fffbf8', ink: '#4a3b33', inkSoft: '#6d5a4f', muted: '#8f7d72', gold: '#c9a24a', goldSoft: '#e6d3a3', line: '#efe2d4', cream: '#fdf3e8', tint: '#fdf5e9', rose: '#d6848d', roseDeep: '#c96f7a', roseSoft: '#fbe9eb', shadow: '#785032' },
  },
  {
    id: 'sage',
    name: '세이지 그린',
    colors: { bg: '#eef1ea', bgGlow: '#e1eadb', card: '#fbfcf8', ink: '#36402f', inkSoft: '#56614c', muted: '#7f8a76', gold: '#b5a45e', goldSoft: '#dcd8b4', line: '#e2e7d8', cream: '#f2f5ea', tint: '#eef3e4', rose: '#8fa77f', roseDeep: '#748e64', roseSoft: '#e5eedd', shadow: '#465a3c' },
  },
  {
    id: 'sky',
    name: '스카이 블루',
    colors: { bg: '#edf2f7', bgGlow: '#dce8f5', card: '#fbfdff', ink: '#2f3a4a', inkSoft: '#4f5d70', muted: '#7a8799', gold: '#9fb3c8', goldSoft: '#cfdbe8', line: '#e1e8f0', cream: '#f1f5fa', tint: '#eaf1f8', rose: '#7fa3c9', roseDeep: '#6189b5', roseSoft: '#e3edf7', shadow: '#3c506e' },
  },
  {
    id: 'lavender',
    name: '라벤더',
    colors: { bg: '#f2eff7', bgGlow: '#e9e0f4', card: '#fdfbff', ink: '#3d3550', inkSoft: '#5e5570', muted: '#8a8199', gold: '#c2a867', goldSoft: '#e3d6ee', line: '#ebe4f2', cream: '#f6f1fa', tint: '#f3edf9', rose: '#a58cc8', roseDeep: '#8d72b5', roseSoft: '#eee6f7', shadow: '#503c6e' },
  },
  {
    id: 'butter',
    name: '버터 옐로우',
    colors: { bg: '#f8f3e6', bgGlow: '#f6ebcc', card: '#fffdf7', ink: '#4a4030', inkSoft: '#6b5e45', muted: '#8f8470', gold: '#c9a24a', goldSoft: '#ead9a8', line: '#efe5cc', cream: '#fbf5e4', tint: '#fbf3dc', rose: '#dcae55', roseDeep: '#c8963a', roseSoft: '#f8ecd0', shadow: '#826428' },
  },
  {
    id: 'navy',
    name: '네이비 & 골드',
    colors: { bg: '#eceef3', bgGlow: '#e0e4ee', card: '#fdfdfd', ink: '#232a3d', inkSoft: '#454d63', muted: '#7b8194', gold: '#c3a45a', goldSoft: '#e2d4a8', line: '#e6e6ec', cream: '#f5f4f0', tint: '#f7f2e4', rose: '#3f5075', roseDeep: '#2a3856', roseSoft: '#e8ebf2', shadow: '#283250' },
  },
];

const VARS: Record<keyof Palette, string> = {
  bg: '--bg',
  bgGlow: '--bg-glow',
  card: '--card',
  ink: '--ink',
  inkSoft: '--ink-soft',
  muted: '--muted',
  gold: '--gold',
  goldSoft: '--gold-soft',
  line: '--line',
  cream: '--cream',
  tint: '--tint',
  rose: '--rose',
  roseDeep: '--rose-deep',
  roseSoft: '--rose-soft',
  shadow: '--shadow',
};

export function findTheme(id: string | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

// Applies the palette to <html> so every page (and the body background) picks it up.
export function useTheme(id: string | undefined) {
  useEffect(() => {
    if (!id) return;
    const { colors } = findTheme(id);
    const style = document.documentElement.style;
    for (const key of Object.keys(VARS) as (keyof Palette)[]) style.setProperty(VARS[key], colors[key]);
  }, [id]);
}
