import {hyNode, type HYNode, type HYComponentKind, type HYComponentProps} from '@haiyue/ui/core';
function n<K extends HYComponentKind>(kind:K,key:string,props:HYComponentProps[K],children?:readonly HYNode[],options?:{slots?:Readonly<Record<string,readonly HYNode[]>>}):HYNode { return hyNode(kind,key,props,{children,...options}); }
export interface DemoState {title:string;source:string;quality:string;tab:string;enabled:boolean;amount:number;dialog:boolean;count:number;status:string;}
export const initialState=():DemoState=>({title:'海月实验室',source:'中文输入 / emoji 🌙\n选择、复制、粘贴与撤销',quality:'75',tab:'settings',enabled:true,amount:50,dialog:false,count:0,status:'准备就绪'});
const quality=[{value:'50',label:'50%'},{value:'75',label:'75%'},{value:'100',label:'100%'},{value:'200',label:'200%（禁用）',disabled:true}];
export function scenario(s:DemoState, features:{systemIcons?:boolean}={}):HYNode {
  return n('Column','screen',{layout:{padding:[12,16,12,16],gap:8}},[
    n('Text','heading',{text:'Haiyue · 原生组件',layout:{height:32}}),
    n('Text','status',{text:`${s.status} · 点击 ${s.count} 次`,wrap:true,layout:{height:48}}),
    n('Row','toolbar',{layout:{gap:6}},[
      n('Button','increment',{text:'计数',layout:{grow:1}}),n('Button','dialog',{text:'弹窗',layout:{grow:1}}),n('Button','cycles',{text:'50 次清理',layout:{grow:1}}),
    ]),
    n('Scroll','scroll',{axis:'vertical',layout:{grow:1}},[
      n('Column','body',{layout:{gap:10}},[
        n('FormGroup','name',{label:'工程名称（中文输入与选区）',layout:{gap:4}},[
          n('TextInput','title',{value:s.title,placeholder:'输入中文',a11y:{label:'工程名称'},layout:{height:48,padding:[8,8,8,8]}}),
        ]),
        n('TextArea','source',{value:s.source,a11y:{label:'代码草稿'},layout:{height:112,padding:[8,8,8,8]}}),
        n('TextInput','password',{value:'',secure:true,placeholder:'密码不会写入日志',a11y:{label:'密码'},layout:{height:44}}),
        n('Tabs','tabs',{value:s.tab,options:[{value:'settings',label:'设置'},{value:'preview',label:'预览'}]},undefined,{slots:{
          settings:[n('Column','settings',{layout:{gap:8}},[
            n('Grid','grid',{layout:{columns:[{grow:1},100],rows:['auto','auto'],gap:8}},[
              n('Text','switch-label',{text:'实时预览',layout:{row:0,column:0}}),n('Toggle','enabled',{checked:s.enabled,a11y:{label:'实时预览'},layout:{row:0,column:1}}),
              n('Text','quality-label',{text:'渲染分辨率',layout:{row:1,column:0}}),n('Select','quality',{value:s.quality,options:quality,a11y:{label:'渲染分辨率'},layout:{row:1,column:1}}),
            ]),
            n('Slider','amount',{value:s.amount,min:0,max:100,step:5,a11y:{label:'亮度'},layout:{height:48}}),
            n('Text','amount-label',{text:`亮度：${s.amount}`}),
          ])],
          preview:[n('Overlay','preview',{layout:{height:130}},[
            n('PlatformView','surface',{slot:'preview',resourceId:`quality:${s.quality}`,layout:{height:130}}),
            n('Text','badge',{text:'原生预览插槽',layout:{align:'end',height:28}}),
          ])],
        }}),
        n('PlatformView','editor',{slot:'editor',resourceId:s.source,layout:{height:64}}),
        n('Row','images',{layout:{gap:8,height:32}},[
          n('Icon','icon',{resource:{id:'moon',alt:'月亮'},...(features.systemIcons?{systemName:'moon.stars.fill'}:{}),layout:{width:28,height:28}}),
          n('Image','image',{resource:{id:'moon',alt:'图片资源'},layout:{width:28,height:28}}),
          n('Button','disabled',{text:'禁用按钮',disabled:true}),
        ]),
        n('Button','theme',{text:'切换主题与字号'}),
      ]),
    ]),
    n('Dialog','modal',{open:s.dialog,title:'原生模态窗口',dismissible:true,layout:{gap:12}},[
      n('Text','message',{text:'验证系统返回、焦点恢复和中文输入。关闭后保留页面草稿。'}),
      n('TextInput','note',{value:'',placeholder:'弹窗内输入',a11y:{label:'弹窗备注'},layout:{height:48}}),
    ],{slots:{footer:[n('Button','close',{text:'关闭弹窗'})]}}),
  ]);
}
