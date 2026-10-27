# Live CodeArts Req Check

## Account State

- `ListProjectsV4` in `cn-north-4`: `total=0`
- `ListProjectsV4` in `cn-east-3`: `total=0`
- `CreateProjectV4` in both regions: `PM.02100546`
- Error message: `该企业租户服务处于关闭状态`

## Signed CLI Request

The CLI was invoked with the configured endpoint and AK/SK, using a deliberately
non-existent 32-character project ID:

```text
PM.02115301
调用 projectservice 失败：项目不存在或项目已被删除
HTTP 400
```

Because the gateway returned a business error rather than an authentication
error, the CLI's SDK-HMAC-SHA256 signature and request path were accepted.

## Remaining Manual Prerequisite

The account owner must open CodeArts Req in the Huawei Cloud console and create
or select a project. Then run:

```bash
node req-cli.mjs issue create "首页加载缓慢" \
  --project-id <project-id> \
  --tracker 3 \
  --priority 3 \
  --severity 12 \
  --description "打开首页加载缓慢" \
  --json
```

No AK/SK or token is recorded in this report.
