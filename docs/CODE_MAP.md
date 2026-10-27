# 代码地图

> 最后更新：2026-10-27

## 总体结构

```text
req-cli/
├─ req-cli.mjs
├─ test/req-cli.test.mjs
├─ docs/
├─ reports/
├─ package.json
└─ README.md
```

## 模块职责

- `req-cli.mjs`：参数解析、配置校验、签名、HTTP 调用和输出。
- `test/req-cli.test.mjs`：帮助、参数、签名、成功与错误路径测试。
- `reports/`：真实环境预检和最终测试记录。

## 逐文件核心内容

### `req-cli.mjs`

- 用途：CodeArts Req 创建工作项 CLI。
- 关键入口：`parseArgs()`、`buildSignature()`、`createIssue()`、`runCLI()`。
- 数据流：命令行参数 → 校验 → SDK-HMAC-SHA256 签名 → HTTP → 结构化输出。
- 注意：只打印脱敏错误，不输出 AK/SK。
