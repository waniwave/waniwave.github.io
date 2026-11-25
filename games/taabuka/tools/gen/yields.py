# 論客にカテゴリと降参の決まりを付ける（content/yields.yaml）。python3 tools/gen/yields.py
# 名前から思いつくカテゴリ。無ければ順番に。降参の決まりはカテゴリと順番で散らす
import os, yaml, glob
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'content')
CATS = yaml.safe_load(open(os.path.join(ROOT, 'balance', 'tiers.yaml')))['categories']
KW = [('麺', '麺'), ('屋台', '麺'), ('ラーメン', '麺'), ('食', '食べ物'), ('飯', '食べ物'), ('湯', '湯'), ('番台', '湯'), ('猫', '動物'), ('ハチ', '動物'), ('動物', '動物'),
      ('校', '校庭'), ('運動', '校庭'), ('老', '老'), ('懐古', '老'), ('過去', '老'), ('古', '老'), ('死', '死'), ('dat', '死'), ('消', '死'), ('あぼーん', '死'), ('1001', '死'),
      ('速', '速さ'), ('即', '速さ'), ('秒速', '速さ'), ('格', '格ゲー'), ('連勝', '格ゲー'), ('論破', '格ゲー'), ('ロボ', 'ロボ'), ('工場', 'ロボ'), ('木人', 'ロボ'),
      ('スレ', 'スレ'), ('安価', 'スレ'), ('コピペ', 'スレ'), ('荒', 'スレ'), ('まとめ', 'スレ'), ('自演', 'スレ'), ('ID', 'スレ'), ('コテ', 'スレ'), ('既読', 'スレ'), ('拡散', 'スレ'), ('規', 'スレ'),
      ('ター', 'ター'), ('Tier', 'ター'), ('格付け', 'ター'), ('神', 'ター'), ('信者', 'ター'), ('宿', '宿'), ('下足', '宿'), ('玄関', '宿'), ('襖', '宿'), ('約款', '宿'), ('帳場', '宿'), ('神主', 'ター')]
# カテゴリごとに降参の決まりの候補（そのカテゴリの論客らしい降り方）
BY = {'スレ': ['呆れ', '論点ずらし'], 'ター': ['番付落ち', '共感'], '宿': ['封殺', '根負け'], '麺': ['共感', '番付落ち'], '食べ物': ['共感', '根負け'],
      '湯': ['根負け', '封殺'], '動物': ['共感', '呆れ'], '校庭': ['論点ずらし', '根負け'], '老': ['根負け', '番付落ち'], '死': ['番付落ち', '封殺'],
      '速さ': ['論点ずらし', '封殺'], '格ゲー': ['封殺', '共感'], 'ロボ': ['呆れ', '論点ずらし']}
SKIP = {'en_ghost', 'en_mokujin', 'en_shihan'}
out = {}
i = 0
for f in sorted(glob.glob(os.path.join(ROOT, 'enemies', '*.yaml'))):
    for e in yaml.safe_load(open(f)) or []:
        if e['id'] in SKIP or (e.get('cat') and e.get('yield')): continue
        if e.get('bind') or e.get('kind') == '底の主': continue  # 形態の変わる主は降参しない（自分で番付を動かすため）
        cat = next((c for k, c in KW if k in e['name']), CATS[i % len(CATS)])
        kinds = BY[cat]
        out[e['id']] = {'cat': cat, 'yield': {'kind': kinds[i % len(kinds)]}}
        i += 1
head = "# 論客のカテゴリと降参の決まり（tools/gen/yields.py で作る。個別に直すときはここを書き換えてよい）\n# 降参の決まり：番付落ち・封殺・呆れ・根負け・論点ずらし・共感（engine/yield.js、数値は balance/hands.yaml yields）\n"
open(os.path.join(ROOT, 'yields.yaml'), 'w').write(head + yaml.safe_dump(out, allow_unicode=True, sort_keys=True, default_flow_style=True, width=200).replace('}, ', '},\n'))
from collections import Counter
print(len(out), Counter(v['yield']['kind'] for v in out.values()), Counter(v['cat'] for v in out.values()))
