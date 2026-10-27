# req-cli

`req-cli` wraps the Huawei Cloud CodeArts Req `CreateIssueV4` API
(`POST /v4/projects/{project_id}/issue`) as a script-friendly command.

## Requirements

- Node.js 18 or newer.
- A CodeArts Req project.
- Huawei Cloud AK/SK with permission to create work items.

## Configuration

```powershell
$env:CODEARTS_REQ_ENDPOINT = "https://projectman-ext.cn-north-4.myhuaweicloud.com"
$env:CODEARTS_REQ_AK = "<access-key-id>"
$env:CODEARTS_REQ_SK = "<secret-access-key>"
```

Never commit `.env` or real AK/SK values.

## Usage

```bash
node req-cli.mjs issue create "Login page blank" \
  --project-id 0123456789abcdef0123456789abcdef \
  --tracker 3 \
  --priority 3 \
  --json
```

Complete help:

```bash
node req-cli.mjs issue create --help
```

Tracker IDs: `2` Task, `3` Bug, `5` Epic, `6` Feature, `7` Story.

Priority IDs: `1` Low, `2` Medium, `3` High.

## Exit Codes

| Code | Meaning |
|---:|---|
| 0 | Success |
| 1 | API error with upstream `error_code` / `error_msg` |
| 2 | Invalid argument, missing configuration, or unsafe endpoint |
| 3 | Network or response parsing error |

Errors are written to stderr. `--json` produces structured success or error
output suitable for scripts and agents.

## Tests

```bash
npm test
```
