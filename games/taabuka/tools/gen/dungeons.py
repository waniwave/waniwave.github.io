# テーマの穴（ダンジョン）を作る。python3 tools/gen/dungeons.py
# 出力：content/dungeons.yaml、content/layers/dg_*.yaml、content/enemies/dungeons.yaml、content/souvenirs_dg.yaml（お土産に追記）
import os, yaml, json

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'content')
def L(i):
    return yaml.safe_load(open(os.path.join(ROOT, 'layers', f'layer{i}.yaml')))
HONKO = {i: L(i) for i in range(1, 6)}
TINT = {'yatai': '#f4e7d2', 'kousha': '#e9ebe6', 'yukemuri': '#e3eef0', 'gesen': '#ece6f4', 'koujou': '#e6e8ea', 'kakolog': '#efe9d6', 'urayama': '#e7efdf', 'yaneura': '#f3e4cf'}
CURSES = yaml.safe_load(open(os.path.join(ROOT, 'layers', 'beyond.yaml')))['curses']

# id, 名前, カテゴリ, 開け方, 強さのずれ（階）, レアリティのずれ（層）, 本坑の敵の層（浅い層1〜3に使う）, 色, 一言, 層の名前3つ, 層主（新しい敵）, 専用お土産
DG = [
  dict(id='yatai', name='屋台通り', cats=['麺', '食べ物', '宿'], unlock={'key': 'sv_key_yatai'}, power=1, rar=0, base=[1, 2, 2],
       bg='#2a1d14', ink='#f3e3c8', line='提灯の下を、どこまでも屋台が続いている。',
       layers=['のれん横丁', '湯気の路地', '屋台の終点'],
       boss=dict(id='en_dg_oyaji', name='屋台の親父', custom='スレ立て', acts=['攻め', {'伏せ': 1}, '攻め', '溜め'], line='へい、らっしゃい。替え玉は論破のあとだ',
                 intro=['へい、らっしゃい。替え玉は論破のあとだ', 'うちの麺はTier1。異論は丼で受ける'], defeat=['……お代はいらねえ', '次は大盛りで来な']),
       sv=dict(id='sv_dg_yatai', name='屋台の割り箸', sell=40, text='割ると、いい音がする。')),
  dict(id='kousha', name='旧校舎', cats=['校庭', '老', '死'], unlock={'rank': 1}, power=2, rar=0, base=[2, 2, 3],
       bg='#20242a', ink='#e6e2d6', line='誰もいない廊下に、チャイムだけが鳴る。',
       layers=['昇降口', '理科室の奥', '開かずの職員室'],
       boss=dict(id='en_dg_kouchou', name='旧校舎の校長', custom='宿泊約款第8条', acts=['攻め', '攻め', '全体攻め'], line='話は短めにします（長い）',
                 intro=['えー、本日は、えー、お日柄もよく', '話は短めにします'], defeat=['以上で、話を終わります（まだ続く）', 'きりーつ、れい']),
       sv=dict(id='sv_dg_kousha', name='誰かの上履き', sell=45, text='名前が消えかけている。')),
  dict(id='yukemuri', name='湯けむり坑', cats=['湯', '動物'], unlock={'key': 'sv_key_yu'}, power=3, rar=1, base=[2, 3, 3],
       bg='#1d2a2c', ink='#e4eff0', line='どこまでも湯気。どこかで猿が湯に浸かっている。',
       layers=['脱衣所', '露天の崖', '源泉の底'],
       boss=dict(id='en_dg_bandai', name='番台', custom='逆さ宿', acts=['攻め', '溜め', '攻め'], line='入湯料は論破でお願いします',
                 intro=['入湯料は論破でお願いします', '桶は元の場所に'], defeat=['お釣りはいりません', 'いいお湯でした']),
       sv=dict(id='sv_dg_yu', name='湯の花', sell=50, text='どこの湯の花かは、言わないでおく。')),
  dict(id='gesen', name='ゲーセン跡', cats=['格ゲー', '速さ'], unlock={'rank': 2}, power=4, rar=1, base=[3, 3, 4],
       bg='#16121f', ink='#f0e4ff', line='電源の入っていない筐体から、BGMが聞こえる。',
       layers=['両替機前', '対戦台の列', '店長の休憩室'],
       boss=dict(id='en_dg_rensho', name='百連勝の常連', custom='秒速5タームメートル', acts=['攻め', '全体攻め', '攻め'], line='乱入どうぞ',
                 intro=['乱入どうぞ', 'コインを積んでおいた'], defeat=['……百一連勝ならず', 'いい対戦でした（台パン）']),
       sv=dict(id='sv_dg_gesen', name='メダル', sell=55, text='どの台にも入らない。')),
  dict(id='koujou', name='廃工場', cats=['ロボ', 'ター'], unlock={'key': 'sv_key_koujou'}, power=5, rar=1, base=[3, 4, 4],
       bg='#1c1e20', ink='#e2e6e8', line='止まったはずのベルトコンベアに、札が流れてくる。',
       layers=['搬入口', '組立ライン', '工場長室'],
       boss=dict(id='en_dg_kojocho', name='工場長ロボ', custom='格付け師', acts=['攻め', '攻め', '全体攻め'], line='検品ヲ開始シマス',
                 intro=['検品ヲ開始シマス', 'アナタノ札ハ規格外デス'], defeat=['検品、合格', '定時デス。帰リマス']),
       sv=dict(id='sv_dg_koujou', name='余ったネジ', sell=60, text='組み立てた後に必ず出てくる。')),
  dict(id='kakolog', name='過去ログ倉庫', cats=['スレ', '死', '老'], unlock={'rank': 3}, power=6, rar=2, base=[4, 4, 5],
       bg='#1a1915', ink='#e8e2cc', line='棚という棚に、落ちたスレが積まれている。',
       layers=['dat落ちの棚', '圧縮の間', '1001の部屋'],
       boss=dict(id='en_dg_1001', name='1001', custom='dat落ち', acts=['攻め', {'居座り': 0.1}], line='このスレッドは1000を超えました',
                 intro=['このスレッドは1000を超えました', 'もう書けないので、論破で語る'], defeat=['新しいスレッドを立ててください', '……次スレで会おう']),
       sv=dict(id='sv_dg_kakolog', name='黄ばんだログ', sell=70, text='読むと、なつかしい議論が始まる。')),
  dict(id='urayama', name='神社の裏山', cats=['ター', '動物', '宿'], unlock={'key': 'sv_key_urayama'}, power=7, rar=2, base=[4, 5, 5],
       bg='#1a2316', ink='#e8f0dc', line='鳥居をくぐるたびに、少しだけ番付が動く。',
       layers=['参道', '奥の院', '御神木の根'],
       boss=dict(id='en_dg_kannushi', name='裏山の神主', custom='Tier8', acts=['攻め', '攻め', '溜め'], line='おみくじを引きなさい。全部Tier8です',
                 intro=['おみくじを引きなさい', '本日の運勢、Tier8'], defeat=['大吉', 'お守りを持って帰りなさい']),
       sv=dict(id='sv_dg_urayama', name='おみくじ', sell=80, text='「論破：吉」')),
]
YANE = dict(id='yaneura', name='床上', cats=[], unlock={'clearAll': True}, power=18, rar=4, prefix='F',
            bg='#2a1a10', ink='#f6e8c6', line='屋根裏へ、上っていく。番付は最初から逆さだ。',
            layers=['天井裏', '梁の上', '棟木の先'],
            boss=dict(id='en_dg_yanenoura', name='屋根裏の主', custom='襖の主', acts=['攻め', '攻め', '全体攻め'], line='上から見ると、床下も同じに見える',
                      intro=['上から見ると、床下も同じに見える', 'ようこそ、宿の上へ'], defeat=['……空が見えた', '降りる時は気をつけて']),
            sv=dict(id='sv_dg_yane', name='金の鯱の鱗', sell=200, text='屋根の一番上にあったもの。'))

def layer_doc(dg, k, name, base_layer, last):
    h = HONKO[base_layer]
    lo = 1 + 3 * k
    d = dict(id=f"dg_{dg['id']}_{k+1}", dungeon=dg['id'], name=name, floors=[lo, lo + 2], line=dg['line'] if k == 0 else f"{dg['name']}・{name}",
             palette=dict(bg=TINT[dg['id']], ink='#2a2520'), doors=h['doors'], groups=h['groups'], elites=h['elites'],
             bosses=[dg['boss']['id']] if last else h['bosses'], warden=h['warden'], stalker=h['stalker'], quirk=h.get('quirk'))
    return d

def bottom_doc(dg):
    return dict(id=f"dg_{dg['id']}_soko", dungeon=dg['id'], name=f"{dg['name']}の底", floors=[10, 9999], line='名前のない階が、続いている。',
                palette=dict(bg='#0d0c10', ink='#d8d2c8'), mix=True, noName=True, bossEvery=3,
                doors={'戦い': 42, '精鋭': 18, '宝': 11, '商い': 9, '湯': 9, '謎': 11}, warden='en_kaerimichi', stalker='en_shisen', quirk=None,
                curseEvery=3, curses=CURSES)

def main():
    dungeons, enemies, souv, flavor = [], [], [], {}
    keys = []
    for i, dg in enumerate(DG + [YANE]):
        for k in range(3):
            base = dg.get('base', [5, 5, 5])[k] if 'base' in dg else 5
            doc = layer_doc(dg, k, dg['layers'][k], base, k == 2)
            yaml.safe_dump(doc, open(os.path.join(ROOT, 'layers', f"dg_{dg['id']}_{k+1}.yaml"), 'w'), allow_unicode=True, sort_keys=False, default_flow_style=None)
        b = bottom_doc(dg)
        if dg['id'] == 'yaneura': b['name'] = '屋根の上'
        yaml.safe_dump(b, open(os.path.join(ROOT, 'layers', f"dg_{dg['id']}_soko.yaml"), 'w'), allow_unicode=True, sort_keys=False, default_flow_style=None)
        bo = dg['boss']
        enemies.append(dict(id=bo['id'], name=bo['name'], layer=[], kind='層主', hp=1.1, atk=1.0, acts=bo['acts'], custom=bo['custom'], line=bo['line']))
        flavor[bo['id']] = dict(intro=bo['intro'], defeat=bo['defeat'])
        s = dg['sv']
        souv.append(dict(id=s['id'], name=s['name'], sell=s['sell'], weight=1, dungeons=[dg['id']], rate=3, use='内装・両替', flavor=s['text']))
        if 'key' in dg['unlock']:
            keys.append((dg, dg['unlock']['key']))
        dungeons.append(dict(id=dg['id'], name=dg['name'], cats=dg['cats'], unlock=dg['unlock'], power=dg['power'], rarityAdd=dg['rar'],
                             prefix=dg.get('prefix', 'B'), line=dg['line'], color=dg['bg'], **({'rules': ['番付を反転']} if dg['id'] == 'yaneura' else {})))
    # 鍵：本坑の決まった層で、まれに出る
    key_layers = {'sv_key_yatai': [1, 2], 'sv_key_yu': [2, 3], 'sv_key_koujou': [3, 4], 'sv_key_urayama': [4, 5]}
    key_names = {'sv_key_yatai': '屋台の暖簾の切れ端', 'sv_key_yu': '湯けむり坑の下足札', 'sv_key_koujou': '廃工場の入館証', 'sv_key_urayama': '裏山の鳥居の鍵'}
    for dg, k in keys:
        souv.append(dict(id=k, name=key_names[k], sell=10, weight=1, layers=key_layers[k], dungeons=['honko'], rate=0.35, use=f"穴の鍵：持ち帰ると「{dg['name']}」が開く", flavor='どこかの入口に合いそうだ。'))
    head = "# テーマの穴（ダンジョン）。tools/gen/dungeons.py で作る（手で直さない）\n# cats：その札がよく出るカテゴリ／unlock：key（そのお土産を持ち帰る）・rank（宿の格の段）・clearAll（全ての穴の層主を倒す）\n# power：敵の強さを何階ぶん上げるか／rarityAdd：レアリティの表を何層ぶん上げるか／prefix：階の呼び方（床上は F）\n"
    open(os.path.join(ROOT, 'dungeons.yaml'), 'w').write(head + yaml.safe_dump(dungeons, allow_unicode=True, sort_keys=False, default_flow_style=None))
    open(os.path.join(ROOT, 'enemies', 'dungeons.yaml'), 'w').write("# テーマの穴の層主（tools/gen/dungeons.py）\n" + yaml.safe_dump(enemies, allow_unicode=True, sort_keys=False, default_flow_style=None))
    sp = os.path.join(ROOT, 'souvenirs.yaml')
    s = open(sp).read()
    mark = '\n# ── テーマの穴（tools/gen/dungeons.py）──\n'
    if mark in s: s = s[:s.index(mark)]
    open(sp, 'w').write(s.rstrip() + '\n' + mark + yaml.safe_dump(souv, allow_unicode=True, sort_keys=False, default_flow_style=None))
    json.dump(flavor, open('/tmp/dg_flavor.json', 'w'), ensure_ascii=False)
    print(len(dungeons), 'dungeons', len(enemies), 'bosses', len(souv), 'souvenirs')

main()
