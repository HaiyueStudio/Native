# iPhone 商品查询验证 — 2026-09-22

已使用正式团队签名构建 Debug 包并更新安装，未发起付款或恢复认证。

- 独立测试存档默认英文，32/32 界面及交互检查通过。
- 六种语言解锁面板与下拉选择检查通过；英文截图已人工检查。
- StoreKit 商品查询返回 unavailable，price=null，canPurchase=false。这不代表真实购买流程通过。
- 已退出隔离测试模式并恢复正常启动；现有中文偏好、8 个通关日期和 1 个星标日期保留。
- 待确认 App Store Connect 商品状态、付费 App 协议状态及商品配置同步后，再验证本地化价格和沙盒交易。

详见 verification.json、iphone-iap.jsonl、iphone-normal.jsonl 与 iphone-iap-en.png。
