# 项目：req-cli CLI 封装

> 最后更新：2026-10-27

## 项目总览

- 目标：完成 ICT 1.11，把 CodeArts Req `CreateIssueV4` 封装为稳定 CLI。
- 技术栈：Node.js 24、内置 `crypto`、`fetch`、`node:test`，无第三方依赖。
- 运行：`node req-cli.mjs issue create --help`
- 入口：`req-cli.mjs`

## 环境配置

- 系统：Windows 11
- Node.js：v24.18.1
- CodeArts endpoint：`https://projectman-ext.cn-north-4.myhuaweicloud.com`
- 凭据：`CODEARTS_REQ_AK` / `CODEARTS_REQ_SK` 仅通过环境变量注入
- 永久 AK/SK 不写入项目、日志或提交仓库

## 当前状态

- 已完成：CLI 实现、10 条自动化测试、`--help`/参数错误实测、真实签名路由预检。
- 正在进行：整理证据、公开仓库和正式提交。
- 下一步：提交第 11 题；账户开通 CodeArts Req 后补做真实工作项创建。
- 卡点：当前华为云租户的 CodeArts Req 服务返回 `PM.02100546`，项目列表为空，无法完成最终创建。

## 需求与约定

- 顶层命令 `req-cli issue create <title>`。
- 完整 `--help`、参数与标志、退出码、`--json`、stderr 错误。
- 成功 0；参数/配置错误 2；API 错误 1；网络错误 3。
- 函数注释必须包含功能、输入、输出。

## 待办

- [x] 确认 API 与参数契约
- [x] 完成实现与自动化测试
- [x] 完成真实 API 签名预检
- [ ] 在 CodeArts Req 开通后创建工作项
- [ ] 创建公开仓库并正式提交

## 版本历史

- 2026-10-27：确认 1.11 要求和 CodeArts Req API 契约。
- 2026-10-27：完成 10 条测试并确认签名请求可到达 API 网关。
