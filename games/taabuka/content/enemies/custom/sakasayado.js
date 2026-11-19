// 層主「逆さ宿」：戦闘のあいだ番付が上下反転し、採点も右から（戦闘が終われば戻る）
export default {
  name: '逆さ宿',
  kind: 'enemy',
  text: '戦闘の始めに番付を上下反転し、採点順を逆にする（どちらも戦闘が終われば戻る）',
  hooks: {
    'battle.start': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (e && !e.dead) {
        env.api.addRule(B, env, { name: '番付を反転', scope: 'battle', group: 'enemy', owner: me.owner });
        env.api.addRule(B, env, { name: '採点順を逆に', scope: 'battle', group: 'enemy', owner: me.owner });
      }
      next();
    },
  },
};
