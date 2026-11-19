// 式の値「専用の札」：この出しで採点された札のうち、専用のカテゴリを持つ札の数（taaaam様専用）
export default {
  name: '専用の札',
  kind: 'var',
  text: '採点札のうち「専用」のカテゴリを持つ札の数（taaaam様専用）',
  get: (E) => {
    const cat = E.B?.guestState?.専用;
    if (!cat) return 0;
    return (E.sc?.scored || []).filter((c) => E.env.api.cardView(c, E.env.balance).cats.includes(cat)).length;
  },
};
