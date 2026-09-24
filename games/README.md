# Native 内置游戏

本目录包含蜘蛛纸牌、Sky Strike、魔方、AK47 Range、Neon Circuit 及它们共用的存档工具。PBR Orbit 示例的代码原本就在 examples/ 内。

初始副本取自 Native 0.1.0 冻结时的实际 Games 文件，包含基线提交之后的修复。文件来源和 SHA-256 保存在 UPSTREAM.json；原始 MIT 文本保留在 LICENSE。此信息仅供溯源，构建和发布验证不会访问 Games 仓库。

原生适配器在 examples/，游戏规则与渲染逻辑在本目录，以后修改 Native 游戏时直接编辑此处。复制时保留了网页入口文件供参考，但 Native 仓库不提供网页开发服务器或承诺浏览器构建入口。

自有图片、音效及生成记录随源码提供；大块 RGBA 纹理由构建脚本从图片重新生成。第三方模型的本地输入规则见 [ASSETS.md](ASSETS.md)。
