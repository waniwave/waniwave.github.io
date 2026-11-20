# rework.py のあとに content/sets へ当てる手直し（何度当てても同じになる）。作り直し仕様の P4 で決めたもの
import glob, re, os
ROOT = '/home/claude/taabuka/content/sets'
def rw(p, f):
    s = open(p).read(); t = f(s)
    if t != s: open(p, 'w').write(t)

# ほとり第6波・taaaam の解放：組→重なり
for p in glob.glob(f'{ROOT}/h_*/set.yaml'):
    rw(p, lambda s: s.replace('unlock: { hand:  { 同類:  50 } }          # ほとり第6波（同類を累計50回）', 'unlock: { overlap: { 4: 50 } }          # ほとり第6波（4枚以上の重なりを累計50回）'))

# 議題：カテゴリごとに1段上げる
def gidai(s):
    if '# 議題（組ごとに1つ。' not in s: return s
    a = s.index('# 議題（組ごとに1つ。'); b = s.index('# 番付札')
    cats = ['食べ物','死','宿','動物','スレ','湯','校庭','速さ','格ゲー','ター','老','麺','ロボ']
    ids = ['tj_gi_tanki','tj_gi_tsui','tj_gi_nitsui','tj_gi_sanzoroi','tj_gi_kaidan','tj_gi_dourui','tj_gi_manin','tj_gi_yonzoroi','tj_gi_douruikaidan','tj_gi_gozoroi','tj_gi_manindourui','tj_gi_gozoroidourui','tj_gi_kamigumi']
    out = ['# 議題（カテゴリごとに1つ。使うとそのカテゴリを1段上げる。IDは昔の組の名残）']
    for i, c in zip(ids, cats):
        out.append(f'- id: {i}\n  name: 議題「{c}」\n  kind: 議題\n  use: いつでも\n  text: 「{c}」を番付で1段上げる\n  do: [ {{ 番付を上げる: {{ カテゴリ: {c} }} }} ]\n')
    return s[:a] + '\n'.join(out) + '\n' + s[b:]
rw(f'{ROOT}/taajuku/items.yaml', gidai)

# 専用の鍵
rw(f'{ROOT}/taaaam/relics.yaml', lambda s: s.replace("""  text: 同類の段位が＋2の状態で戦う
  flavor: 合う鍵穴は一つだけ。
  rule:
  - {名前: 段位を足す, 組: 同類, 段: 2}""", """  text: 採点札のカテゴリが1種類だけなら倍率×1.5
  flavor: 合う鍵穴は一つだけ。
  fx:
  - when: 出し
    if: { でない: { カテゴリの種類以上: 2 } }
    do: [ { 掛け: 1.5 } ]"""))

# 宣言（流行語）：カテゴリを宣言
rw(f'{ROOT}/ryukogo/keywords.yaml', lambda s: s.replace('  text: 出すときに好きな組を1つ宣言し、成立していなくてもその組として採点する', '  text: 出すときにカテゴリを1つ宣言し、出した札が全てそのカテゴリを持っていることにする'))
SENGEN = open('/home/claude/taabuka/tools/gen/sengen.js').read()
open(f'{ROOT}/ryukogo/custom/sengen.js', 'w').write(SENGEN)
open(f'{ROOT}/ryukogo/custom/kougo.js', 'w').write(open('/home/claude/taabuka/tools/gen/kougo.js').read())
rw(f'{ROOT}/ryukogo/keywords.yaml', lambda s: s.replace('  text: 採点の順番をカテゴリが交互になるように並べ替え、交互が続いた数だけ倍率×1.5', '  text: 出した札を全て採点し、カテゴリが交互になるよう並べ替え、交互が続いた数だけ倍率×1.5'))
open(f'{ROOT}/ryukogo/custom/nibai.js', 'w').write(open('/home/claude/taabuka/tools/gen/nibai.js').read())
print('post ok')
