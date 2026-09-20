import { Button, Color, GridLayout, Label, Page, ScrollView, StackLayout, Switch } from '@nativescript/core';
import { selectRule, type RuleKey } from '../../../../Games/games/led-sudoku/extra-rules';
import { DEFAULT_OPTIONS, type Options } from '../../../../Games/games/led-sudoku/rules';
export const RULES = [
  ['led', 'LED 灯管', '部分亮段作为线索，默认开启'], ['diagonal', '对角线', '两条对角线数字不重复'],
  ['missing', '缺一门', '每行、列、宫各一个黑格，不填数'], ['killer', '杀手数独', '虚线笼内不重复，数字和等于标注'],
  ['renban', '连续数 · 升/降', '沿整条紫线每步差 1，全部升序或全部降序'], ['consecutive', '相邻连续 · 差 1', '白点两侧差 1，无点不能差 1'],
  ['inequality', '数比数独', '大小符号的尖端指向较小数'], ['multiDiagonal', '多对角线', '金色编号斜线上数字不重复'],
  ['exclusion', '排除点', '圆圈周围四格不能填标注或亮段匹配数'], ['parity', '奇偶数独', '蓝底＋偶：偶数；红底＋奇：奇数'],
  ['thermometer', '温度计', '青绿圆灯泡到平头严格递增；与连续数互斥'],
  ['skyscraper', '摩天大楼', '外圈数字表示可见楼数；与缺一门互斥'],
  ['xv', 'XV 数独', 'V 和为 5，X 和为 10，全标记；与数比、差 1 互斥'],
  ['quadruple', '四数和', '菱形 Σ 是周围四格之和；与排除点互斥'],
] as const;
export function showSettings(parent: Page, current: Options): Promise<Options | null> {
  return new Promise(resolve => {
    let draft = { ...DEFAULT_OPTIONS, ...current };
    const page = new Page(); page.actionBarHidden = true; page.className = 'sheet'; page.iosOverflowSafeArea = false;
    const root = new GridLayout(); root.rows = '50,55,*,64,50'; root.padding = 18; root.iosOverflowSafeArea = false; root.backgroundColor = new Color('#061015');
    const head = new GridLayout(); head.columns = '*,60'; const title = new Label(); title.text = '新数独'; title.fontSize = 24; title.color = new Color('#d6e9ea'); head.addChild(title);
    const cancel = new Button(); cancel.text = '取消'; GridLayout.setColumn(cancel, 1); cancel.on('tap', () => page.closeModal(null)); head.addChild(cancel); root.addChild(head);
    const levels = new GridLayout(); levels.columns = '*,*,*'; GridLayout.setRow(levels, 1);
    const difficulties: Button[] = [];
    (['easy', 'normal', 'hard'] as const).forEach((d, i) => { const b = new Button(); b.text = ['入门', '标准', '挑战'][i]; b.className = draft.difficulty === d ? 'active' : ''; GridLayout.setColumn(b, i); b.on('tap', () => { draft.difficulty = d; difficulties.forEach((v, n) => v.className = i === n ? 'active' : ''); }); difficulties.push(b); levels.addChild(b); }); root.addChild(levels);
    const scroll = new ScrollView(); GridLayout.setRow(scroll, 2); const list = new StackLayout();
    const switches = new Map<RuleKey, Switch>(); let syncing=false;
    const note = new Label(); note.text = '每局验证唯一解 · 挑战需超出唯一候选和唯一位置的推理'; note.textWrap=true;
    for (const [key, name, copy] of RULES) {
      const row = new GridLayout(); row.columns = '*,64'; row.className = 'rule-row';
      const text = new StackLayout(); const label = new Label(); label.text = name; label.fontSize = 15; label.color = new Color('#d6e9ea'); const sub = new Label(); sub.text = copy; sub.fontSize = 11; sub.color = new Color('#8ba6ae'); sub.textWrap = true; sub.marginTop = 5; text.addChild(label); text.addChild(sub); row.addChild(text);
      const toggle = new Switch(); toggle.checked = !!draft[key]; toggle.accessibilityLabel = name; GridLayout.setColumn(toggle, 1); switches.set(key,toggle); toggle.on('checkedChange', () => { if(syncing) return; const change=selectRule(draft,key,toggle.checked); draft=change.options; syncing=true; switches.forEach((s,k)=>s.checked=!!draft[k]); syncing=false; note.text=change.notice || '每局验证唯一解 · 挑战需超出唯一候选和唯一位置的推理'; }); row.addChild(toggle); list.addChild(row);
    }
    scroll.content = list; root.addChild(scroll);
    note.color = new Color('#8ba6ae'); note.fontSize = 10; note.textAlignment = 'center'; note.verticalAlignment = 'middle'; GridLayout.setRow(note, 3); root.addChild(note);
    const start = new Button(); start.text = '开始新数独'; start.className = 'primary'; GridLayout.setRow(start, 4); start.on('tap', () => page.closeModal(draft)); root.addChild(start);
    page.content = root;
    parent.showModal(page, { fullscreen: true, closeCallback: (result?: Options) => resolve(result ?? null) });
  });
}
