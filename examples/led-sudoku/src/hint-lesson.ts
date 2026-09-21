import { THEMES, type ThemeId } from '../../../../Games/games/led-sudoku/theme';
import { Button, Color, GridLayout, Label, ScrollView } from '@nativescript/core';
import { lessonText, type HintStep } from '../../../../Games/games/led-sudoku/hint-explanation';
import type { Language } from '../../../../Games/games/led-sudoku/i18n';
/** Inline panel keeps the engine board visible and interactive native buttons
 * outside ancestor raw-touch recognizers. It never modifies the player board. */
export class HintLessonPanel extends GridLayout {
  private readonly heading=new Label();
  private readonly body=new Label();
  private readonly legend=new Label();
  private readonly previous=new Button();
  private readonly next=new Button();
  private readonly close=new Button();
  private readonly scroll=new ScrollView();
  constructor(move:(delta:number)=>void,finish:()=>void) {
    super();this.id='hint-lesson';this.rows='44,*,32,52';this.padding='4 6';this.backgroundColor=new Color('#0b2028');this.borderRadius=10;this.visibility='collapse';
    const header=new GridLayout();header.columns='*,44';this.heading.fontSize=17;this.heading.fontWeight='bold';this.heading.color=new Color('#ffd18a');this.heading.verticalAlignment='middle';header.addChild(this.heading);
    this.close.text='×';this.close.id='lesson-close';this.close.accessibilityIdentifier=this.close.id;this.close.on('tap',finish);GridLayout.setColumn(this.close,1);header.addChild(this.close);this.addChild(header);
    this.body.id='lesson-body';this.body.accessibilityIdentifier=this.body.id;this.body.fontSize=16;this.body.verticalAlignment='top';this.body.textWrap=true;this.body.color=new Color('#e0edf0');this.body.padding='5 2';this.scroll.content=this.body;GridLayout.setRow(this.scroll,1);this.addChild(this.scroll);
    this.legend.fontSize=10;this.legend.textWrap=true;this.legend.color=new Color('#9ac0c6');this.legend.verticalAlignment='middle';GridLayout.setRow(this.legend,2);this.addChild(this.legend);
    const controls=new GridLayout();controls.columns='*,*';GridLayout.setRow(controls,3);this.addChild(controls);
    this.previous.id='lesson-previous';this.previous.accessibilityIdentifier=this.previous.id;this.previous.on('tap',()=>move(-1));controls.addChild(this.previous);
    this.next.id='lesson-next';this.next.accessibilityIdentifier=this.next.id;this.next.className='primary';this.next.on('tap',()=>move(1));GridLayout.setColumn(this.next,1);controls.addChild(this.next);
  }
  setTheme(theme:ThemeId):void { const c=THEMES[theme];this.backgroundColor=new Color(c.lesson);this.heading.color=new Color(c.focus);this.body.color=new Color(c.text);this.legend.color=new Color(c.muted); }
  show(step:HintStep,index:number,count:number,language:Language,elimination=false):void {
    const say=(zh:string,en:string,ja:string)=>lessonText(language,zh,en,ja);
    this.heading.text=`${index+1} / ${count}  ${step.title}`;this.body.text=step.text;this.scroll.scrollToVerticalOffset(0,false);
    this.legend.text=say('金框：当前观察  ·  青框：依据  ·  划线数字：排除','Gold: focus · Cyan: evidence · Crossed digit: excluded','金：注目マス · 水色：根拠 · 取消線：除外');
    this.previous.text=say('上一步','Previous','戻る');this.previous.isEnabled=index>0;this.next.text=index===count-1?(elimination?say('应用到笔记','Apply to notes','メモに反映'):say('返回棋盘','Back to puzzle','盤面へ戻る')):say('下一步','Next','次へ');
    this.close.accessibilityLabel=say('关闭讲解','Close explanation','解説を閉じる');this.visibility='visible';
  }
}
