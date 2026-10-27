# req-cli Test Report

- Date: 2026-10-27
- Node.js: v24.18.1
- Test command: `npm test`
- Result: 10 passed, 0 failed

## Covered Cases

| Case | Result |
|---|---|
| Root help | PASS |
| `issue create --help` | PASS |
| Missing required arguments return exit code 2 | PASS |
| Invalid tracker, severity, project ID and date are rejected | PASS |
| Missing configuration fails before network access | PASS |
| Optional flags map to CreateIssueV4 request fields | PASS |
| SDK-HMAC-SHA256 headers are generated deterministically | PASS |
| Successful response is mapped to stable JSON fields | PASS |
| API errors preserve `error_code` and return exit code 1 | PASS |
| Network errors return exit code 3 | PASS |

## Manual CLI Checks

```text
node req-cli.mjs --help
node req-cli.mjs issue create --help
node req-cli.mjs issue create Missing --project-id abc --tracker 3 --priority 3
```

The invalid project ID case returned exit code 2 and wrote the error to stderr.

## Live Request Evidence

A signed request using a non-existent project ID returned:

```text
PM.02115301: 项目不存在或项目已被删除
```

This response proves that the endpoint was reached and the AK/SK signature was
accepted; the request failed only because no valid CodeArts project was available.
