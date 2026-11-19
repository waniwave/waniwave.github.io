// 数字の表記（設定の「数字の表記」：漢字／指数）と、単位ごとの文字色（暖色から虚色へ）
import { format as fmt, unitLevel, unitOf, UNITS } from '../engine/format.js';

let mode = '漢字';
export function setNumMode(m) { mode = m === '指数' ? '指数' : '漢字'; }
/** 表示用の数（設定に従う） */
export function num(x) { return fmt(x, mode === '指数' ? { mode: 'exp' } : {}); }

// 万→億→兆…→無量大数→累乗→ター。暖色（橙・朱・紅）から紫・藍・虚色（青白・緑白）へ
const COLORS = ['#2a2520', '#b86a1c', '#c8501f', '#c8302a', '#b0204a', '#9a1f6e', '#7a2a93', '#5a35a8', '#3f45b8', '#2f5cbf', '#1f73b8',
  '#1a8aa8', '#16998e', '#1fa070', '#4a9a3a', '#7d8f2a', '#8a7a8a', '#5d4f8a', '#2f2a6a', '#101028'];
export function unitColor(x) { return COLORS[Math.min(COLORS.length - 1, unitLevel(x))]; }
/** 単位の大きさ（文字の大きさを少しずつ上げる） */
export function unitScale(x) { return 1 + Math.min(10, unitLevel(x)) * 0.025; }
export { unitLevel, unitOf, UNITS };
