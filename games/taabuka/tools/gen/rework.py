# 札の作り直し（作り直し仕様 C・D）。全セットの cards.yaml の fx と text を役割表から作り直す。
# 使い方：python3 rework.py [--dry]   （/home/claude/taabuka/content/sets/*/cards.yaml を書き換える）
# - tier を消す。grade は「最低レアリティ」として残す（rarity.yaml の gradeFloor）
# - 宿泊客のセット（GUEST_SETS）は、宿泊客の値を使う fx を残し、役割の1行を足す
# - text の数字の印：{+N} 量（レアリティで×mul）、{xN} 掛け（1＋(N−1)×mul）、{dN} 引く枚数
import yaml, glob, json, hashlib, sys, re, os

ROOT = '/home/claude/taabuka/content/sets'
GUEST_SETS = {'ikea', 'koutei', 'maap', 'soutourou', 'taaaam', 'taakaku', 'tatagi', 'tsuchi'}
GUEST_VARS = ['組立数', '部品', '場', '採配点', '採配数', '入れ替え', '植木数', '植樹数', '専用の札', '専用', '熟成']
BAD = ['組', '段位', 'Tier', '宣言', '全札を同Tier', '五揃', '階段', '単騎', '対', '番付倍率']
# 格の係数。札はその格の最低レアリティ（並C×1・上UC×1.5・特上R×2・極L×3・神U×5）で拾われ、量はレアリティで増えるので、
# 最低レアリティで拾ったときに 並1・上1.3・特上1.7・極2.3・神3 の強さになるよう、レアリティの倍率で割っておく
FLOOR_MUL = {'並': 1, '上': 1.5, '特上': 2, '極': 3, '神': 5}
G = {k: v / FLOOR_MUL[k] for k, v in {'並': 1.0, '上': 1.3, '特上': 1.7, '極': 2.3, '神': 3.0}.items()}
LINES = {'並': 1, '上': 1, '特上': 2, '極': 2, '神': 3}

def h(s, k=0):
    return int(hashlib.md5(f'{s}#{k}'.encode()).hexdigest(), 16)

def r1(x):  # 見やすい数
    if x >= 20: return int(round(x / 5) * 5)
    if x >= 5: return int(round(x))
    return round(x * 10) / 10 if abs(x * 10 - round(x * 10)) < 1e-9 or x < 1 else round(x, 1)

def nn(x):
    v = r1(x)
    return int(v) if float(v).is_integer() else v

def mul(g, a):  # 掛け 1＋a×g（小数1桁）
    return round(1 + a * g, 2)

def fx(when, do, cond=None):
    d = {'when': when}
    if cond is not None: d['if'] = cond
    d['do'] = do
    return d

S = '採点時'
# ───────── 役割の型。(text, fx の並び) を返す。P＝その役割のカテゴリ、g＝格の係数、cats＝札のカテゴリ ─────────
def T_speed(P, g, k):
    a = [
        lambda: (f'最初に採点されると強さ{{+{nn(14*g)}}}', [fx(S, [{'強さ': nn(14*g)}], {'採点の順番': '最初'})]),
        lambda: (f'戦闘の1回目の出しなら倍率{{+{nn(1.2*g)}}}', [fx(S, [{'倍率': nn(1.2*g)}], {'戦闘の出し': 1})]),
        lambda: (f'戦闘の1〜2ターン目なら倍率{{x{mul(g,0.25)}}}', [fx(S, [{'掛け': mul(g, 0.25)}], {'でない': {'戦闘のターン以上': 3}})]),
        lambda: (f'このターン最初の出しで採点されると、このターンの出し＋1', [fx(S, [{'出し回数': {'増減': 1, '期間': 'ターン'}}], {'このターンの出し': 1})]),
    ]
    return a[k % len(a)]()

def T_fgc(P, g, k):
    a = [
        lambda: (f'このターン2回目の出しなら倍率{{+{nn(1.6*g)}}}', [fx(S, [{'倍率': nn(1.6*g)}], {'このターンの出し': 2})]),
        lambda: (f'この戦闘で出した回数×{{+{nn(3*g)}}}の強さ', [fx(S, [{'強さ': f'戦闘の出し回数*{nn(3*g)}'}])]),
        lambda: (f'採点されると、狙った敵に{{+{nn(18*g)}}}の追撃', [fx(S, [{'主張を削る': {'対象': '狙い', '量': nn(18*g)}}])]),
        lambda: (f'「{P}」の重なりの枚数×{{+{nn(0.6*g)}}}の倍率', [fx(S, [{'倍率': f'この札の重なり*{nn(0.6*g)}'}])]),
    ]
    return a[k % len(a)]()

def T_men(P, g, k):
    a = [
        lambda: (f'強さ{{+{nn(12*g)}}}', [fx(S, [{'強さ': nn(12*g)}])]),
        lambda: (f'重なりの枚数×{{+{nn(0.5*g)}}}の倍率', [fx(S, [{'倍率': f'この札の重なり*{nn(0.5*g)}'}])]),
        lambda: (f'採点されるたびに育つ。育ち×{{+{nn(3*g)}}}の強さ（この潜行のあいだ残る）', [fx(S, [{'育つ': 1}, {'強さ': f'育ち*{nn(3*g)}'}])]),
        lambda: (f'「{P}」が3枚以上重なれば倍率{{x{mul(g,0.3)}}}', [fx(S, [{'掛け': mul(g, 0.3)}], {'重なり以上': 3, 'カテゴリ': P})]),
    ]
    return a[k % len(a)]()

def T_food(P, g, k):
    a = [
        lambda: (f'体力{{+{nn(3*g)}}}、倍率{{+{nn(0.4*g)}}}', [fx(S, [{'体力': nn(3*g)}, {'倍率': nn(0.4*g)}])]),
        lambda: (f'採点されると、次の出しの強さ{{+{nn(18*g)}}}', [fx(S, [{'次の出しの強さ': nn(18*g)}])]),
        lambda: (f'「{P}」が3枚以上重なれば倍率{{x{mul(g,0.3)}}}', [fx(S, [{'掛け': mul(g, 0.3)}], {'重なり以上': 3, 'カテゴリ': P})]),
        lambda: (f'体力が満タンでなければ体力{{+{nn(5*g)}}}、満タンなら強さ{{+{nn(15*g)}}}', [fx(S, [{'体力': nn(5*g)}], {'値': {'式': '失った体力', '以上': 1}}), fx(S, [{'強さ': nn(15*g)}], {'値': {'式': '失った体力', '以下': 0}})]),
    ]
    return a[k % len(a)]()

def T_sure(P, g, k):
    a = [
        lambda: (f'採点されると{{d1}}枚引く', [fx(S, [{'引く': 1}])]),
        lambda: (f'手札が4枚以下なら、採点されると{{d2}}枚引く', [fx(S, [{'引く': 2}], {'手札枚数以下': 4})]),
        lambda: (f'採点されると、このターンの流し＋1', [fx(S, [{'流し回数': {'増減': 1, '期間': 'ターン'}}])]),
        lambda: (f'手札の枚数×{{+{nn(2.5*g)}}}の強さ', [fx(S, [{'強さ': f'手札枚数*{nn(2.5*g)}'}])]),
        lambda: (f'流したとき{{d1}}枚引く', [fx('流した時', [{'引く': 1}])]),
    ]
    return a[k % len(a)]()

def T_taa(P, g, k):
    a = [
        lambda: (f'採点されると「{P}」を1段上げる', [fx(S, [{'番付を上げる': {'カテゴリ': P}}])]),
        lambda: (f'採点されると、番付で一番低いカテゴリを1段上げる', [fx(S, [{'番付を上げる': {'カテゴリ': '一番低い'}}])]),
        lambda: (f'この札のTierの段の高さ×{{+{nn(0.35*g)}}}の倍率', [fx(S, [{'倍率': f'Tierの段*{nn(0.35*g)}'}])]),
        lambda: (f'採点されると「{P}」をTier8（博打）に送る。強さ{{+{nn(10*g)}}}', [fx(S, [{'番付を移す': {'カテゴリ': P, '先': '8'}}, {'強さ': nn(10*g)}])]),
        lambda: (f'「{P}」がTier1以上なら倍率{{x{mul(g,0.3)}}}', [fx(S, [{'掛け': mul(g, 0.3)}], {'番付': {'カテゴリ': P, '以上': '1'}})]),
    ]
    return a[k % len(a)]()

def T_yado(P, g, k):
    a = [
        lambda: (f'受けに回ると受け{{+{nn(12*g)}}}。採点されると受け{{+{nn(5*g)}}}', [fx('受けに回る', [{'受け': nn(12*g)}]), fx(S, [{'受け': nn(5*g)}])]),
        lambda: (f'いまの受け×{{+{nn(0.5*g)}}}の強さ（守った分を返す）', [fx(S, [{'強さ': f'受け*{nn(0.5*g)}'}])]),
        lambda: (f'採点されると、2割5分で狙った敵の次の行動を消す', [fx(S, [{'行動を消す': '狙い'}], {'確率': 0.25})]),
        lambda: (f'手札にあるまま終わると受け{{+{nn(6*g)}}}', [fx('ターン終了', [{'受け': nn(6*g)}])]),
    ]
    return a[k % len(a)]()

def T_yu(P, g, k):
    a = [
        lambda: (f'体力{{+{nn(4*g)}}}', [fx(S, [{'体力': nn(4*g)}])]),
        lambda: (f'採点されると、番付で一番低いカテゴリを1段上げる', [fx(S, [{'番付を上げる': {'カテゴリ': '一番低い'}}])]),
        lambda: (f'体力が半分以下なら倍率{{x{mul(g,0.3)}}}', [fx(S, [{'掛け': mul(g, 0.3)}], {'体力の割合以下': 0.5})]),
        lambda: (f'流したとき体力{{+{nn(4*g)}}}', [fx('流した時', [{'体力': nn(4*g)}])]),
    ]
    return a[k % len(a)]()

def T_school(P, g, k):
    a = [
        lambda: (f'採点されると、2割で狙った敵を1ターン止める', [fx(S, [{'行動停止': {'対象': '狙い', 'ターン': 1}}], {'確率': 0.2})]),
        lambda: (f'残っている敵の数×{{+{nn(7*g)}}}の強さ', [fx(S, [{'強さ': f'敵の数*{nn(7*g)}'}])]),
        lambda: (f'戦闘の3ターン目以降なら倍率{{+{nn(1.6*g)}}}', [fx(S, [{'倍率': nn(1.6*g)}], {'戦闘のターン以上': 3})]),
        lambda: (f'採点されると、1割5分で敵全員の次の行動を消す', [fx(S, [{'行動を消す': '敵全員'}], {'確率': 0.15})]),
    ]
    return a[k % len(a)]()

def T_rou(P, g, k):
    a = [
        lambda: (f'採点されるたびに育つ。育ち×{{+{nn(0.25*g)}}}の倍率（この潜行のあいだ残る）', [fx(S, [{'育つ': 1}, {'倍率': f'育ち*{nn(0.25*g)}'}])]),
        lambda: (f'戦闘の3ターン目以降なら倍率{{x{mul(g,0.3)}}}', [fx(S, [{'掛け': mul(g, 0.3)}], {'戦闘のターン以上': 3})]),
        lambda: (f'手札に残ると倍率{{+{nn(0.4*g)}}}', [fx('手札に残る', [{'倍率': nn(0.4*g)}])]),
        lambda: (f'捨て札の枚数×{{+{nn(1.5*g)}}}の強さ', [fx(S, [{'強さ': f'捨て札枚数*{nn(1.5*g)}'}])]),
    ]
    return a[k % len(a)]()

def T_shi(P, g, k):
    a = [
        lambda: (f'体力−3。強さ{{+{nn(25*g)}}}', [fx(S, [{'体力': -3}, {'強さ': nn(25*g)}])]),
        lambda: (f'体力が3割以下なら倍率{{x{mul(g,0.6)}}}', [fx(S, [{'掛け': mul(g, 0.6)}], {'体力の割合以下': 0.3})]),
        lambda: (f'失った体力×{{+{nn(0.6*g)}}}の強さ', [fx(S, [{'強さ': f'失った体力*{nn(0.6*g)}'}])]),
        lambda: (f'採点されると手札の一番弱い札を捨て、倍率{{+{nn(1.2*g)}}}', [fx(S, [{'捨てる': {'対象': '手札の一番弱い', '枚数': 1}}, {'倍率': nn(1.2*g)}])]),
    ]
    return a[k % len(a)]()

def T_animal(P, g, k):
    a = [
        lambda: (f'重なりの枚数×{{+{nn(5*g)}}}の強さ', [fx(S, [{'強さ': f'この札の重なり*{nn(5*g)}'}])]),
        lambda: (f'「{P}」が3枚以上重なれば倍率{{x{mul(g,0.3)}}}', [fx(S, [{'掛け': mul(g, 0.3)}], {'重なり以上': 3, 'カテゴリ': P})]),
        lambda: (f'同じカテゴリの札と一緒なら倍率{{+{nn(0.7*g)}}}', [fx(S, [{'倍率': nn(0.7*g)}], {'同じカテゴリの札が他に': True})]),
        lambda: (f'「{P}」が5枚重なれば倍率{{x{mul(g,0.6)}}}', [fx(S, [{'掛け': mul(g, 0.6)}], {'重なり以上': 5, 'カテゴリ': P})]),
    ]
    return a[k % len(a)]()

def T_robo(P, g, k):
    a = [
        lambda: (f'採点札の効果の無い札1枚につき倍率{{+{nn(0.6*g)}}}', [fx(S, [{'倍率': f'効果なしの札*{nn(0.6*g)}'}])]),
        lambda: (f'採点されると、手札の一番弱い札に「{P}」を足す（この戦闘）', [fx(S, [{'札を変える': {'対象': '手札の一番弱い', 'カテゴリを足す': P, '期間': '戦闘'}}])]),
        lambda: (f'効果の無い札が2枚以上採点されていれば倍率{{x{mul(g,0.35)}}}', [fx(S, [{'掛け': mul(g, 0.35)}], {'効果なしの札': 2})]),
        lambda: (f'採点されると、手札の乱数の1枚に「{P}」を足す（この戦闘）。強さ{{+{nn(6*g)}}}', [fx(S, [{'札を変える': {'対象': '手札の乱数', 'カテゴリを足す': P, '期間': '戦闘'}}, {'強さ': nn(6*g)}])]),
    ]
    return a[k % len(a)]()

ROLE = {'速さ': T_speed, '格ゲー': T_fgc, '麺': T_men, '食べ物': T_food, 'スレ': T_sure, 'ター': T_taa, '宿': T_yado,
        '湯': T_yu, '校庭': T_school, '老': T_rou, '死': T_shi, '動物': T_animal, 'ロボ': T_robo}

# ───────── またぐ型（2カテゴリ以上の札） ─────────
def T_bridge(cats, g, k):
    P, Q = cats[0], cats[1]
    a = [
        lambda: (f'「{P}」と「{Q}」が両方2枚以上重なれば倍率{{x{mul(g,0.35)}}}', [fx(S, [{'掛け': mul(g, 0.35)}], [{'重なり以上': 2, 'カテゴリ': P}, {'重なり以上': 2, 'カテゴリ': Q}])]),
        lambda: (f'採点札のカテゴリが3種類以上なら倍率{{+{nn(1.2*g)}}}', [fx(S, [{'倍率': nn(1.2*g)}], {'カテゴリの種類以上': 3})]),
        lambda: (f'2枚以上重なったカテゴリの数×{{+{nn(0.7*g)}}}の倍率', [fx(S, [{'倍率': f'重なったカテゴリの数*{nn(0.7*g)}'}])]),
        lambda: (f'採点札のカテゴリの種類×{{+{nn(6*g)}}}の強さ', [fx(S, [{'強さ': f'カテゴリの種類*{nn(6*g)}'}])]),
    ]
    if len(cats) >= 3:
        R = cats[2]
        a.append(lambda: (f'「{P}」「{Q}」「{R}」が全部重なれば倍率{{x{mul(g,0.6)}}}', [fx(S, [{'掛け': mul(g, 0.6)}], [{'重なり以上': 2, 'カテゴリ': P}, {'重なり以上': 2, 'カテゴリ': Q}, {'重なり以上': 2, 'カテゴリ': R}])]))
    return a[k % len(a)]()

def has_bad(c):
    s = json.dumps({k: c.get(k) for k in ('fx', 'rule')}, ensure_ascii=False)
    return any(w in s for w in ['"組"', '段位', '"Tier"', 'Tier以上', '全札を同Tier', '組を宣言', '組を1段上', '番付倍率'])

def uses_guest(c):
    s = json.dumps(c.get('fx') or [], ensure_ascii=False)
    return any(v in s for v in GUEST_VARS)

def build(c, set_id):
    cats = c['cat']; gr = c['grade']; g = G[gr]; cid = c['id']
    parts = []; fxs = []
    keep = set_id in GUEST_SETS and c.get('fx') and uses_guest(c) and not has_bad(c)
    if keep:
        fxs = c['fx']; parts = [c.get('text', '').strip()]
        n_new = 1 if gr in ('特上', '極', '神') else 0
    else:
        n_new = LINES[gr]
    # 効果の無い札：並で、もとから効果が無く、キーワードも無いもの（少なめ）
    if not keep and gr == '並' and not c.get('fx') and not c.get('kw') and not c.get('rule') and len(cats) == 1 and h(cid, 5) % 2 == 0:
        return None, ''
    used = set()
    order = cats[:]
    for i in range(n_new):
        if len(cats) >= 2 and (i == 1 or (gr == '上' and h(cid, 9) % 2 == 0) or (keep and i == 0 and h(cid, 7) % 2 == 0)):
            k = h(cid, 20 + i)
            t, f = T_bridge(cats, g, k)
        else:
            P = order[(i // 2 + h(cid, 3)) % len(order)] if i != 2 else order[-1]
            k = h(cid, 10 + i)
            t, f = ROLE[P](P, g, k)
            tries = 0
            while t in used and tries < 6:
                k += 1; tries += 1; t, f = ROLE[P](P, g, k)
        if t in used: continue
        used.add(t); parts.append(t); fxs = fxs + f
    text = '。'.join(p.rstrip('。') for p in parts if p) 
    return fxs, text

def dump_val(v):
    return json.dumps(v, ensure_ascii=False)

def emit(c):
    out = [f"- id: {c['id']}", f"  name: {dump_val(c['name'])}", f"  cat: {dump_val(c['cat'])}", f"  grade: {c['grade']}"]
    for k in ('origin',):
        if c.get(k): out.append(f"  {k}: {c[k]}")
    if c.get('kw'): out.append(f"  kw: {dump_val(c['kw'])}")
    if c.get('text'): out.append(f"  text: {dump_val(c['text'])}")
    out.append(f"  flavor: {dump_val(c.get('flavor', ''))}")
    if c.get('fx'):
        out.append('  fx:')
        for f in c['fx']: out.append(f"    - {dump_val(f)}")
    for k in ('rule', 'show'):
        if c.get(k): out.append(f"  {k}: {dump_val(c[k])}")
    return '\n'.join(out)

def main(dry):
    stat = {'kept': 0, 'vanilla': 0, 'new': 0}
    for f in sorted(glob.glob(f'{ROOT}/*/cards.yaml')):
        set_id = f.split('/')[-2]
        raw = open(f).read()
        head = []
        for line in raw.splitlines():
            if line.startswith('#'): head.append(line)
            else: break
        cards = yaml.safe_load(raw) or []
        outs = []
        for c in cards:
            c = dict(c)
            c.pop('tier', None); c.pop('test', None)
            if c.get('kw'):
                c['kw'] = [k for k in c['kw'] if k != '宣言' or set_id == 'ryukogo']
            # 祟りなど「効果のある」キーワードだけの札も、効果の行を作る
            fxs, text = build(c, set_id)
            if fxs is None:
                c.pop('fx', None); c['text'] = ''; stat['vanilla'] += 1
            else:
                was_kept = fxs is c.get('fx')
                c['fx'] = fxs; c['text'] = text
                stat['kept' if was_kept else 'new'] += 1
            c.pop('rule', None) if c.get('rule') and has_bad({'rule': c['rule']}) else None
            outs.append(emit(c))
        body = '\n'.join(head) + ('\n\n' if head else '') + '\n\n'.join(outs) + '\n'
        if not dry: open(f, 'w').write(body)
    print(stat)

if __name__ == '__main__':
    main('--dry' in sys.argv)
