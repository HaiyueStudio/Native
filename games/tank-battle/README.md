# 铁甲前线：原生游戏源码

独立的 1P 手机实现，入口为 `MobileTankGame.ts`；NativeScript App 工程在
`../../examples/tank-battle`。本目录包含确定性规则、虚拟摇杆输入、Engine GUI 场景、
像素坦克与地形图集、生成的触控贴图以及 PCM 音效，无跨仓运行时依赖。

2026-10-12 从 Games/tank-battle 同步规则、精灵和手机场景。与桌面双人模式分开保存，
存档只接受完整有效的 1P 状态。图片来源和打包规则见 `assets/controls-art.md`。
