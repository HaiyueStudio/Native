# 皮肤验证（2026-09-21）

支持深色流光 / 晴空浅蓝。设置下拉框中即时切换并独立保存，不改变棋局。

- Games 数独专项 214 项、Native 12 项测试通过；两端类型检查、网页构建、Android 构建通过。未改引擎，未运行全仓检查。
- 安卓 X4000 独立存档 100 项检查通过，包括下拉选择、主题名国际化、两页同时换肤、棋局不变。
- `settings-light.png`：浅蓝设置页；`classic-light.png`：最终版本普通数字棋盘；`restored-light.png`：重启后保留浅蓝皮肤。
- `led-before-output-fix.png` 记录最初发现的色调压缩问题。最终浅蓝皮肤使用 Render3DSystem 的公开 toneMapping='none' 选项，背景明亮度已在最终普通数字截图中确认；深色保留原输出配置。
- 设置读取、非法值兼容、存储往返、笔记与全暗 LED 绘制、文字对比度有专项回归。
- 最终版本已覆盖安装，正常存档的 puzzle、board、notes、crossed、deductionSteps、solution、assisted 安装前后一致。实际选择浅蓝皮肤并重启，存储 theme='light-blue'。
