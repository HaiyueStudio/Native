import { THEMES, THEME_IDS, type ThemeId } from '../../../../Games/games/led-sudoku/theme';
import { Application, Button, Color, GridLayout, Image, Label, Page, ScrollView, StackLayout, Switch, type TouchGestureEventData } from '@nativescript/core';
import { selectRule, type RuleKey } from '../../../../Games/games/led-sudoku/extra-rules';
import { DEFAULT_OPTIONS, type Options } from '../../../../Games/games/led-sudoku/rules';
import { LANGUAGE_NAMES, LANGUAGES, RULE_KEYS, ruleCopy, t, type Language } from '../../../../Games/games/led-sudoku/i18n';
import { autoCandidateFiltering, preferences, type Preferences } from '../../../../Games/games/led-sudoku/preferences';
import { SelectionDropdown } from './dropdown';
import { IconButton } from './icon-button';
export const RULES = RULE_KEYS.map(key => [key, ...ruleCopy('zh', key)] as const);
function label(size=14): Label { const v=new Label();v.fontSize=size;v.textWrap=true;v.verticalAlignment='middle';return v; }
function shell(theme:ThemeId = 'dark'): {page:Page;root:GridLayout;layers:GridLayout} {
  const page=new Page();page.actionBarHidden=true;page.className=theme;page.iosOverflowSafeArea=false;
  const root=new GridLayout();root.padding=18;root.backgroundColor=new Color(THEMES[theme].background);root.iosOverflowSafeArea=false;
  const layers=new GridLayout();layers.addChild(root);page.content=layers;return {page,root,layers};
}
/** Down opens immediately. Release, cancellation and a scroll gesture all dismiss. */
export function bindHoldHelp(hit: Button, show: () => void, hide: () => void): void {
  let origin:{x:number;y:number}|null=null;
  hit.on('touch',data=>{const e=data as TouchGestureEventData;
    if(e.action==='down'){origin={x:e.getX(),y:e.getY()};show();}
    else if(e.action==='up'||e.action==='cancel'){origin=null;hide();}
    else if(e.action==='move'&&origin&&Math.hypot(e.getX()-origin.x,e.getY()-origin.y)>12){origin=null;hide();}
  });
}
export function showSettings(parent: Page, current: Options, language: Language = 'zh', theme:ThemeId = 'dark'): Promise<Options | null> {
  return new Promise(resolve=>{
    let draft={...DEFAULT_OPTIONS,...current},closing=false;const {page,root,layers}=shell(theme);const colors=THEMES[theme];root.rows='52,56,30,*,50,52';
    const finish=(result:Options|null)=>{
      if(closing)return;closing=true;hide();
      root.isUserInteractionEnabled=false;
      close.isEnabled=false;start.isEnabled=false;
      levelButtons.forEach(b=>b.isEnabled=false);switches.forEach(s=>s.isEnabled=false);
      page.closeModal(result ? {...result} : null);
    };
    const head=new GridLayout();head.columns='*,44';
    const back=new IconButton('back',()=>finish(null),true);back.setTheme(theme);back.setLabel(t(language,'back'));GridLayout.setColumn(back,1);
    const close=back.hit;close.id='rules-cancel';close.accessibilityIdentifier=close.id;head.addChild(back);
    const title=label(24);title.text=t(language,'newGame');title.marginRight=12;head.addChild(title);root.addChild(head);
    const levels=new GridLayout();levels.columns='*,*,*';GridLayout.setRow(levels,1);root.addChild(levels);const levelButtons:Button[]=[];
    (['easy','normal','hard'] as const).forEach((difficulty,i)=>{const b=new Button();b.text=t(language,difficulty);b.className=draft.difficulty===difficulty?'active':'';GridLayout.setColumn(b,i);b.on('tap',()=>{draft.difficulty=difficulty;levelButtons.forEach((v,n)=>v.className=i===n?'active':'');});levels.addChild(b);levelButtons.push(b);});
    const instruction=label(11);instruction.text=t(language,'holdHelp');instruction.color=new Color(colors.muted);GridLayout.setRow(instruction,2);root.addChild(instruction);
    const scroll=new ScrollView();GridLayout.setRow(scroll,3);root.addChild(scroll);const list=new StackLayout();scroll.content=list;
    const notice=label(11);notice.text=t(language,'unique');GridLayout.setRow(notice,4);root.addChild(notice);
    const tip=new GridLayout();tip.id='rule-tip';tip.backgroundColor=new Color(theme==='dark'?'#d2061015':'#ddedf6fc');tip.isUserInteractionEnabled=false;tip.visibility='collapse';
    const card=new StackLayout();card.width='90%';card.padding=20;card.verticalAlignment='middle';card.horizontalAlignment='center';card.backgroundColor=new Color(colors.panel);card.borderWidth=1;card.borderColor=new Color(colors.accent);card.borderRadius=12;
    const tipTitle=label(19),tipBody=label(15);tipTitle.color=new Color(colors.accent);tipBody.marginTop=16;card.addChild(tipTitle);card.addChild(tipBody);tip.addChild(card);layers.addChild(tip);
    const hide=()=>tip.visibility='collapse';scroll.on('scroll',hide);
    // Do not observe raw touches on the form: on iOS an ancestor's touch
    // recognizer delays UIButton touch-up, so Start/Cancel/difficulty never tap.
    // The question button owns release/cancel; ScrollView owns scroll dismissal.
    Application.on(Application.suspendEvent,hide);page.on('unloaded',()=>{hide();Application.off(Application.suspendEvent,hide);});
    const switches=new Map<RuleKey,Switch>();let syncing=false;
    for(const key of RULE_KEYS){
      const [name,description]=ruleCopy(language,key),row=new GridLayout();row.columns='*,44,62';row.minHeight=56;row.className='rule-row';
      const nameLabel=label(15);nameLabel.text=name;row.addChild(nameLabel);
      const help=new GridLayout();help.width=help.height=44;GridLayout.setColumn(help,1);row.addChild(help);
      const icon=new Image();icon.src='~/icons/help.png';icon.tintColor=new Color(colors.muted);icon.width=icon.height=19;icon.isUserInteractionEnabled=false;icon.accessibilityHidden=true;help.addChild(icon);
      const hit=new Button();hit.id=`help-${key}`;hit.text='';hit.className='icon-hit';hit.accessibilityLabel=`${name}: ${description}`;help.addChild(hit);
      bindHoldHelp(hit,()=>{if(closing)return;tipTitle.text=name;tipBody.text=description;tip.visibility='visible';},hide);
      const toggle=new Switch();toggle.checked=!!draft[key];toggle.accessibilityLabel=name;GridLayout.setColumn(toggle,2);row.addChild(toggle);switches.set(key,toggle);
      toggle.on('checkedChange',()=>{if(syncing)return;const previous=draft;draft=selectRule(draft,key,toggle.checked).options;syncing=true;switches.forEach((v,k)=>v.checked=!!draft[k]);syncing=false;const disabled=RULE_KEYS.filter(k=>previous[k]&&!draft[k]&&k!==key);notice.text=disabled.length?t(language,'switchedOff',{names:disabled.map(k=>ruleCopy(language,k)[0]).join(', ')}):t(language,'unique');});
      list.addChild(row);
    }
    const start=new Button();start.id='rules-start';start.accessibilityIdentifier=start.id;start.text=t(language,'start');start.className='primary';GridLayout.setRow(start,5);start.on('tap',()=>finish(draft));root.addChild(start);
    parent.showModal(page,{fullscreen:true,closeCallback:(result?:Options)=>{hide();Application.off(Application.suspendEvent,hide);resolve(result??null);}});
  });
}
export function showPreferences(parent:Page,current:Preferences,changed:(value:Preferences)=>void):Promise<void>{
  return new Promise(resolve=>{
    let draft={...current},syncing=false;const {page,root}=shell(draft.theme);root.rows='52,*,52';
    const title=label(24);root.addChild(title);const scroll=new ScrollView();GridLayout.setRow(scroll,1);root.addChild(scroll);const body=new StackLayout();scroll.content=body;
    const languageLabel=label(13);languageLabel.marginTop=22;body.addChild(languageLabel);
    const dropdown=new SelectionDropdown(LANGUAGE_NAMES,index=>{draft.language=LANGUAGES[index]!;apply();});dropdown.id='language-dropdown';dropdown.marginTop=8;dropdown.setSelected(LANGUAGES.indexOf(draft.language));body.addChild(dropdown);
    const skinLabel=label(13);skinLabel.marginTop=22;body.addChild(skinLabel);
    const skin=new SelectionDropdown(['',''],index=>{draft.theme=THEME_IDS[index]!;apply();});skin.id='skin-dropdown';skin.marginTop=8;body.addChild(skin);
    const addToggle=()=>{const row=new GridLayout();row.columns='*,62';row.className='preference-row';const name=label(16);row.addChild(name);const toggle=new Switch();GridLayout.setColumn(toggle,1);row.addChild(toggle);body.addChild(row);const detail=label(12);detail.color=new Color(THEMES[draft.theme].muted);body.addChild(detail);return {name,toggle,detail};};
    const manual=addToggle(),filter=addToggle(),board=addToggle();manual.toggle.id='manual-candidates';filter.toggle.id='filter-candidates';board.toggle.id='show-candidates';const done=new Button();done.id='preferences-done';done.className='primary';GridLayout.setRow(done,2);done.on('tap',()=>page.closeModal());root.addChild(done);
    function refresh(){syncing=true;const colors=THEMES[draft.theme];page.className=draft.theme;root.backgroundColor=new Color(colors.background);manual.detail.color=filter.detail.color=board.detail.color=new Color(colors.muted);skinLabel.text=t(draft.language,'skin');skin.setItems([t(draft.language,'darkSkin'),t(draft.language,'lightBlueSkin')]);skin.setSelected(THEME_IDS.indexOf(draft.theme));skin.setLabel(skinLabel.text);title.text=t(draft.language,'settings');languageLabel.text=t(draft.language,'language');dropdown.setLabel(languageLabel.text);manual.name.text=t(draft.language,'manualCandidates');manual.detail.text=t(draft.language,'manualCandidatesDetail');manual.toggle.checked=draft.manualCandidates;manual.toggle.accessibilityLabel=manual.name.text;filter.toggle.isEnabled=!draft.manualCandidates;filter.name.opacity=draft.manualCandidates ? .4 : 1;filter.name.text=t(draft.language,'filter');filter.detail.text=t(draft.language,draft.manualCandidates?'manualCandidatesActive':'filterDetail');filter.toggle.checked=autoCandidateFiltering(draft);filter.toggle.accessibilityLabel=filter.name.text;board.name.text=t(draft.language,'boardCandidates');board.detail.text=t(draft.language,draft.manualCandidates?'manualCandidatesActive':draft.filterCandidates?'boardCandidatesDetail':'requiresFilter');board.toggle.checked=draft.showCandidates;board.toggle.isEnabled=autoCandidateFiltering(draft);board.toggle.accessibilityLabel=board.name.text;board.name.opacity=autoCandidateFiltering(draft)?1:.4;done.text=t(draft.language,'done');syncing=false;}
    function apply(){draft=preferences(draft);refresh();changed({...draft});}
    manual.toggle.on('checkedChange',()=>{if(syncing)return;draft.manualCandidates=manual.toggle.checked;apply();});
    filter.toggle.on('checkedChange',()=>{if(syncing)return;draft.filterCandidates=filter.toggle.checked;apply();});board.toggle.on('checkedChange',()=>{if(syncing)return;draft.showCandidates=board.toggle.checked;apply();});refresh();
    parent.showModal(page,{fullscreen:true,closeCallback:()=>resolve()});
  });
}
