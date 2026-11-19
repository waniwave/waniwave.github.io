// 条件「専用」：この札が、taaaam様専用で選んだカテゴリを持つ（宿泊客の状態 専用）
export default {
  name: '専用',
  kind: 'if',
  text: 'この札が「専用」のカテゴリを持つ（taaaam様専用）',
  args: 'bool',
  test: (E, a) => {
    const cat = E.B?.guestState?.専用;
    const c = E.subject;
    const yes = !!cat && !!c && E.env.api.cardView(c, E.env.balance).cats.includes(cat);
    return yes === a;
  },
};
