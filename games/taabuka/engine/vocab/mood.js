// 場の状態（content/balance/moods.yaml）。名前の一覧は語彙として固定（数値は数値表）
export const MOODS = ['ノリノリ', 'しんみり', 'グダグダ', 'お祭り', '修羅場', '演歌', '静寂', '大団円'];

/** いまの場の状態の定義（無ければ null） */
export function moodDef(B, balance) {
  return B?.mood ? { id: B.mood.id, ...(balance.moods?.[B.mood.id] || {}) } : null;
}
/** 場の状態を変える（前の状態は上書き） */
export function setMood(B, balance, id, log) {
  const d = balance.moods?.[id];
  if (!d) return;
  B.mood = { id, turns: d.turns ?? 2 };
  log?.(B, { t: 'mood', id, turns: B.mood.turns });
  // 切り替わった瞬間のばかばかしいルール（onSet：plays 出し＋・discards 流し＋・healFull 体力全快）
  const o = d.onSet || {};
  if (o.plays) { B.playsLeft = Math.max(0, (B.playsLeft || 0) + o.plays); log?.(B, { t: 'mod', key: 'plays', delta: o.plays }); }
  if (o.discards) { B.discardsLeft = Math.max(0, (B.discardsLeft || 0) + o.discards); log?.(B, { t: 'mod', key: 'discards', delta: o.discards }); }
  if (o.healFull && B.hp < B.maxHp) { const add = B.maxHp - B.hp; B.hp = B.maxHp; log?.(B, { t: 'hp', add, hp: B.hp }); }
}
/** ターンの終わりに1減らす。0で戻る */
export function tickMood(B, log) {
  if (!B.mood) return;
  B.mood.turns -= 1;
  if (B.mood.turns <= 0) { const id = B.mood.id; B.mood = null; log?.(B, { t: 'mood', id: null, was: id }); }
}
