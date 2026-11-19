// 条件「専用の札」：採点札のうち専用のカテゴリを持つ札が N 枚以上（taaaam様専用）
export default {
  name: '専用の札',
  kind: 'if',
  text: '採点札のうち「専用」のカテゴリを持つ札が N 枚以上（taaaam様専用）',
  args: 'int',
  test: (E, a) => {
    const cat = E.B?.guestState?.専用;
    if (!cat) return false;
    return (E.sc?.scored || []).filter((c) => E.env.api.cardView(c, E.env.balance).cats.includes(cat)).length >= a;
  },
};
