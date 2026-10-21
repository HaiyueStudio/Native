import {hyNode as n,type HYNode} from '@haiyue/ui/core';
export interface GalleryState {gallery:boolean;section:string;checked:boolean;choice:string;rating:number;expanded:boolean;step:number;}
export const galleryDefaults=():GalleryState=>({gallery:false,section:'forms',checked:true,choice:'balanced',rating:3,expanded:false,step:0});
const sectionOptions=[{value:'forms',label:'表单'},{value:'feedback',label:'展示'},{value:'patterns',label:'组合'}];
const modes=[{value:'fast',label:'快速'},{value:'balanced',label:'均衡'},{value:'quality',label:'高质量'},{value:'locked',label:'未解锁',disabled:true}];
export function gallery(s:GalleryState):HYNode {
  return n('Column','catalog',{layout:{gap:12}}, {children:[
    n('Text','intro',{text:'共享组件实验室 · iOS / Android / Web\n值由应用状态控制；禁用项不产生变更。',wrap:true}),
    n('Tabs','sections',{value:s.section,options:sectionOptions},{slots:{
      forms:[n('Column','forms',{layout:{gap:12}},{children:[
        n('Divider','check-title',{text:'Checkbox · 复选框'}),
        n('Checkbox','consent',{text:'接收更新通知',checked:s.checked,a11y:{label:'接收更新通知'}}),
        n('Checkbox','locked-check',{text:'禁用复选框',checked:true,disabled:true}),
        n('Divider','radio-title',{text:'Radio · 单选组'}),
        n('RadioGroup','mode',{value:s.choice,options:modes,a11y:{label:'画质模式'}}),
        n('Text','choice',{text:`当前模式：${s.choice}`}),
        n('Divider','rating-title',{text:'Rate · 整数评分'}),
        n('Rate','rating',{value:s.rating,count:5,a11y:{label:'示例评分'}}),
        n('Text','rating-value',{text:`评分：${s.rating} / 5`}),
        n('Button','clear-rating',{text:'清空评分'}),
        n('Rate','readonly-rating',{value:4,count:5,readOnly:true,a11y:{label:'只读评分'}}),
        n('Rate','disabled-rating',{value:2,count:5,disabled:true,a11y:{label:'禁用评分'}}),
      ]})],
      feedback:[n('Column','feedback',{layout:{gap:12}},{children:[
        n('Divider','badge-title',{text:'Badge · 文本徽标'}),
        n('Row','badges',{layout:{gap:12}},{children:[n('Badge','new',{text:'NEW',layout:{align:'start'}}),n('Badge','count',{text:'12',layout:{align:'start'}}),n('Badge','overflow',{text:'99+',layout:{align:'start'}})]}),
        n('Divider','line',{}),
        n('Text','note',{text:'Divider 支持水平线和标题。徽标当前支持独立文本；圆点、悬挂计数和状态动画尚未纳入共享协议。',wrap:true}),
        n('Button','busy',{text:'处理中',busy:true}),
        n('FormGroup','error',{label:'带错误的输入框',error:'名称不能为空'},{children:[n('TextInput','invalid',{value:'',readOnly:true,placeholder:'输入名称',a11y:{label:'名称',error:'名称不能为空'},layout:{height:48}})]}),
      ]})],
      patterns:[n('Column','patterns',{layout:{gap:12}},{children:[
        n('Text','scope',{text:'以下是通用节点组合示例，对齐 UI 库使用场景；尚不提供 Web 组件的全部高级属性。',wrap:true}),
        n('Divider','collapse-title',{text:'Collapse · 折叠内容'}),
        n('Button','expand',{text:`${s.expanded?'▾':'▸'}  使用说明`,a11y:{label:s.expanded?'收起使用说明':'展开使用说明'}}),
        n('Text','details',{text:'折叠状态由应用持有。切换分类后保留状态，隐藏内容不能响应交互。',visible:s.expanded,wrap:true}),
        n('Divider','steps-title',{text:'Steps · 步骤导航'}),
        n('Row','steps',{layout:{gap:8}},{children:['配置','确认','完成'].map((text,i)=>n('Button',`step-${i}`,{text:`${i===s.step?'●':'○'} ${text}`,layout:{grow:1}}))}),
        n('Badge','current-step',{text:`第 ${s.step+1} 步`,layout:{align:'start'}}),
        n('Divider','group-title',{text:'ButtonGroup · 操作组'}),
        n('Row','actions',{layout:{gap:8}},{children:[n('Button','previous',{text:'上一步',disabled:s.step===0,layout:{grow:1}}),n('Button','next',{text:'下一步',disabled:s.step===2,layout:{grow:1}})]}),
        n('Text','remaining',{text:'后续适配：日期/时间、级联选择、树、虚拟列表、表格、抽屉、通知、引导等。拖拽/悬停组件需单独定义触屏交互。',wrap:true}),
      ]})],
    }}),
  ]});
}
