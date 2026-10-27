#!/usr/bin/env node

import crypto from 'node:crypto';


// TRACKER_LABELS maps CodeArts Req tracker IDs to human-readable names.
const TRACKER_LABELS = {
  2: 'Task',
  3: 'Bug',
  5: 'Epic',
  6: 'Feature',
  7: 'Story',
};
// PRIORITY_LABELS maps priority IDs to the values accepted by CreateIssueV4.
const PRIORITY_LABELS = {
  1: 'low',
  2: 'medium',
  3: 'high',
};
// STATUS_LABELS describes the status IDs shown by the Req API.
const STATUS_LABELS = {
  1: 'new',
  2: 'in-progress',
  3: 'resolved',
  4: 'testing',
  5: 'closed',
  6: 'rejected',
};
// SEVERITY_IDS contains the allowed importance values from the API contract.
const SEVERITY_IDS = new Set([10, 11, 12, 13]);
// VALUE_FLAGS is the complete set of named options accepted by issue create.
const VALUE_FLAGS = new Set([
  'project-id',
  'tracker',
  'priority',
  'description',
  'status-id',
  'severity',
  'assigned-to',
  'parent-issue',
  'iteration',
  'begin',
  'end',
]);


/**
 * 功能：创建带退出码和错误类别的 CLI 异常。
 * 输入：code 为稳定错误码，message 为中文提示，exitCode 为进程退出码，details 为附加字段。
 * 输出：可抛出的 Error；正常返回时无其他副作用。
 */
function createCliError(code, message, exitCode, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.exitCode = exitCode;
  error.details = details;
  return error;
}


/**
 * 功能：验证 yyyy-mm-dd 日期是否真实存在。
 * 输入：value 为待验证字符串。
 * 输出：合法返回 true，否则返回 false。
 */
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}


/**
 * 功能：把字符串解析为正整数。
 * 输入：value 为命令参数文本。
 * 输出：正整数；非法值返回 null。
 */
function parsePositiveInteger(value) {
  if (!/^\d+$/.test(value || '')) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}


/**
 * 功能：解析 issue create 命令参数并执行契约校验。
 * 输入：argv 为不含 node 和脚本路径的命令参数数组。
 * 输出：包含 action、input 和 json 的对象；帮助请求返回 help 主题；非法参数抛出退出码 2 的异常。
 */
function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { help: argv[0] === 'issue' && argv[1] === 'create' ? 'create' : 'root' };
  }
  if (argv[0] !== 'issue' || argv[1] !== 'create') {
    throw createCliError(
      'USAGE_ERROR',
      '未知命令。请使用 req-cli issue create <title> 或查看 --help。',
      2,
    );
  }

  const title = argv[2] && !argv[2].startsWith('--') ? argv[2] : '';
  const flags = {};
  let json = false;
  let index = title ? 3 : 2;
  while (index < argv.length) {
    const token = argv[index];
    if (token === '--json') {
      json = true;
      index += 1;
      continue;
    }
    if (!token.startsWith('--')) {
      throw createCliError('USAGE_ERROR', `无法识别的参数：${token}`, 2);
    }
    const equalsIndex = token.indexOf('=');
    const name = token.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
    if (!VALUE_FLAGS.has(name)) {
      throw createCliError('USAGE_ERROR', `未知标志：--${name}`, 2);
    }
    const value = equalsIndex !== -1 ? token.slice(equalsIndex + 1) : argv[index + 1];
    if (value === undefined || value === '' || (equalsIndex === -1 && value.startsWith('--'))) {
      throw createCliError('USAGE_ERROR', `标志 --${name} 缺少值`, 2);
    }
    flags[name] = value;
    index += equalsIndex === -1 ? 2 : 1;
  }

  if (title.length < 1 || title.length > 512) {
    throw createCliError('USAGE_ERROR', '标题必填，长度必须为 1-512 字符', 2);
  }
  if (!/^[0-9a-fA-F]{32}$/.test(flags['project-id'] || '')) {
    throw createCliError('USAGE_ERROR', '--project-id 必填，且必须是 32 位十六进制项目 ID', 2);
  }
  if (!/^[23567]$/.test(flags.tracker || '')) {
    throw createCliError('USAGE_ERROR', '--tracker 必填，允许值：2/3/5/6/7', 2);
  }
  if (!/^[123]$/.test(flags.priority || '')) {
    throw createCliError('USAGE_ERROR', '--priority 必填，允许值：1/2/3', 2);
  }
  const statusId = flags['status-id'] === undefined ? 1 : parsePositiveInteger(flags['status-id']);
  if (statusId === null || statusId > 6) {
    throw createCliError('USAGE_ERROR', '--status-id 允许值：1-6，默认 1', 2);
  }
  const severity = flags.severity === undefined ? undefined : parsePositiveInteger(flags.severity);
  if (flags.severity !== undefined && !SEVERITY_IDS.has(severity)) {
    throw createCliError('USAGE_ERROR', '--severity 允许值：10/11/12/13', 2);
  }
  for (const flag of ['begin', 'end']) {
    if (flags[flag] !== undefined && !isValidDate(flags[flag])) {
      throw createCliError('USAGE_ERROR', `--${flag} 必须是有效日期，格式 yyyy-mm-dd`, 2);
    }
  }

  const numericFlags = ['assigned-to', 'parent-issue', 'iteration'];
  const numericValues = {};
  for (const flag of numericFlags) {
    if (flags[flag] !== undefined) {
      const value = parsePositiveInteger(flags[flag]);
      if (value === null) {
        throw createCliError('USAGE_ERROR', `--${flag} 必须是正整数`, 2);
      }
      numericValues[flag] = value;
    }
  }

  return {
    action: 'issue.create',
    json,
    input: {
      title,
      projectId: flags['project-id'],
      trackerId: Number(flags.tracker),
      priorityId: Number(flags.priority),
      description: flags.description,
      statusId,
      severityId: severity,
      assignedId: numericValues['assigned-to'],
      parentIssueId: numericValues['parent-issue'],
      iterationId: numericValues.iteration,
      beginTime: flags.begin,
      endTime: flags.end,
    },
  };
}


/**
 * 功能：返回命令行帮助文本。
 * 输入：topic 为 root 或 create。
 * 输出：UTF-8 帮助字符串。
 */
function printHelp(topic = 'root') {
  if (topic === 'create') {
    return `Usage:
  req-cli issue create <title> --project-id <uuid> --tracker <id> --priority <id> [options]

Required:
  <title>                  Work item title, 1-512 characters
  --project-id <uuid>      CodeArts project ID, 32 hexadecimal characters
  --tracker <id>           2 Task / 3 Bug / 5 Epic / 6 Feature / 7 Story
  --priority <id>          1 Low / 2 Medium / 3 High

Optional:
  --description <text>     Work item description
  --status-id <1..6>       Status ID, default 1 (new)
  --severity <10..13>      10 Critical / 11 Major / 12 Normal / 13 Minor
  --assigned-to <n>        Assignee numeric user ID
  --parent-issue <n>       Parent work item ID
  --iteration <n>          Iteration ID
  --begin <yyyy-mm-dd>     Start date
  --end <yyyy-mm-dd>       End date
  --json                   Print a machine-readable response
  --help                   Show this help

Environment:
  CODEARTS_REQ_ENDPOINT    CodeArts Req endpoint
  CODEARTS_REQ_AK          Huawei Cloud Access Key ID
  CODEARTS_REQ_SK          Huawei Cloud Secret Access Key

Exit codes:
  0 Success
  1 API error
  2 Parameter, configuration, or authentication input error
  3 Network or response parsing error

Example:
  req-cli issue create "Login page blank" --project-id 0123456789abcdef0123456789abcdef --tracker 3 --priority 3 --json
`;
  }
  return `req-cli - Huawei Cloud CodeArts Req command-line client

Usage:
  req-cli issue create <title> [options]
  req-cli issue create --help
  req-cli --help

Commands:
  issue create             Create one CodeArts Req work item

Run "req-cli issue create --help" for complete parameters and examples.
`;
}


/**
 * 功能：计算 UTF-8 文本的 SHA-256 十六进制摘要。
 * 输入：data 为待摘要文本。
 * 输出：64 位十六进制摘要。
 */
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}


/**
 * 功能：使用 HMAC-SHA256 计算签名。
 * 输入：key 为密钥，data 为待签文本。
 * 输出：十六进制签名。
 */
function hmacSHA256Hex(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}


/**
 * 功能：把 Date 格式化为华为云 X-Sdk-Date。
 * 输入：date 为 Date，默认当前时间。
 * 输出：UTC 格式 yyyyMMdd'T'HHmmss'Z'。
 */
function formatSdkDate(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}


/**
 * 功能：生成华为云 SDK-HMAC-SHA256 鉴权头。
 * 输入：method、url、ak、sk、body 和可选 date。
 * 输出：authorization、xSdkDate 和规范化后的 URL。
 */
function buildSignature({ method, url, ak, sk, body = '', date = new Date() }) {
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname;
  const xSdkDate = formatSdkDate(date);
  let canonicalUri = parsedUrl.pathname || '/';
  if (!canonicalUri.endsWith('/')) canonicalUri += '/';
  const queryEntries = [...parsedUrl.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const canonicalQuery = queryEntries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  const signedHeaders = 'host;x-sdk-date';
  const canonicalHeaders = `host:${host}\nx-sdk-date:${xSdkDate}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    sha256Hex(body),
  ].join('\n');
  const stringToSign = `SDK-HMAC-SHA256\n${xSdkDate}\n${sha256Hex(canonicalRequest)}`;
  const signature = hmacSHA256Hex(sk, stringToSign);
  return {
    authorization: `SDK-HMAC-SHA256 Access=${ak}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    xSdkDate,
  };
}


/**
 * 功能：从环境读取并校验 CodeArts Req 连接配置。
 * 输入：env 为环境变量对象，默认 process.env。
 * 输出：endpoint、ak、sk 对象；缺项或 endpoint 非法时抛出退出码 2 的异常。
 */
function loadConfig(env = process.env) {
  const endpoint = env.CODEARTS_REQ_ENDPOINT;
  const ak = env.CODEARTS_REQ_AK;
  const sk = env.CODEARTS_REQ_SK;
  if (!endpoint) throw createCliError('CONFIG_ERROR', '缺少环境变量 CODEARTS_REQ_ENDPOINT', 2);
  if (!ak) throw createCliError('CONFIG_ERROR', '缺少环境变量 CODEARTS_REQ_AK', 2);
  if (!sk) throw createCliError('CONFIG_ERROR', '缺少环境变量 CODEARTS_REQ_SK', 2);
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw createCliError('CONFIG_ERROR', 'CODEARTS_REQ_ENDPOINT 不是有效 URL', 2);
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.myhuaweicloud.com')) {
    throw createCliError(
      'CONFIG_ERROR',
      'CODEARTS_REQ_ENDPOINT 必须是以 .myhuaweicloud.com 结尾的 HTTPS 地址',
      2,
    );
  }
  return { endpoint: endpoint.replace(/\/$/, ''), ak, sk };
}


/**
 * 功能：把已校验参数转换为 CreateIssueV4 请求体。
 * 输入：input 为 parseArgs 生成的工作项参数。
 * 输出：仅包含 API 接受字段的请求体对象。
 */
function createIssueBody(input) {
  const body = {
    name: input.title,
    tracker_id: input.trackerId,
    priority_id: input.priorityId,
    status_id: input.statusId,
  };
  const optionalFields = {
    description: input.description,
    severity_id: input.severityId,
    assigned_id: input.assignedId,
    parent_issue_id: input.parentIssueId,
    iteration_id: input.iterationId,
    begin_time: input.beginTime,
    end_time: input.endTime,
  };
  for (const [key, value] of Object.entries(optionalFields)) {
    if (value !== undefined) body[key] = value;
  }
  return body;
}


/**
 * 功能：把 API 响应精简为稳定的工作项结果。
 * 输入：data 为 CreateIssueV4 返回 JSON。
 * 输出：包含 id、name、tracker、priority、status 的对象。
 */
function pickIssue(data) {
  const issue = data?.issue ?? data?.data?.issue ?? data?.data ?? data ?? {};
  const trackerId = Number(issue.tracker_id ?? issue.trackerId ?? 0);
  const priorityId = Number(issue.priority_id ?? issue.priorityId ?? 0);
  const statusId = Number(issue.status_id ?? issue.statusId ?? 0);
  return {
    id: issue.id ?? issue.issue_id ?? null,
    name: issue.name ?? issue.title ?? '',
    tracker: TRACKER_LABELS[trackerId] ?? trackerId,
    priority: PRIORITY_LABELS[priorityId] ?? priorityId,
    status: STATUS_LABELS[statusId] ?? statusId,
    tracker_id: trackerId || null,
    priority_id: priorityId || null,
    status_id: statusId || null,
  };
}


/**
 * 功能：调用 CodeArts Req CreateIssueV4 并返回工作项。
 * 输入：config 为连接配置，input 为工作项参数，fetchImpl 为可选 fetch，now 为可选签名时间。
 * 输出：精简后的工作项对象；API、网络或解析错误转换为对应 CLI 异常。
 */
async function createIssue({ config, input, fetchImpl = fetch, now = new Date() }) {
  const body = createIssueBody(input);
  const bodyText = JSON.stringify(body);
  const url = `${config.endpoint}/v4/projects/${input.projectId}/issue`;
  const { authorization, xSdkDate } = buildSignature({
    method: 'POST',
    url,
    ak: config.ak,
    sk: config.sk,
    body: bodyText,
    date: now,
  });

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'X-Sdk-Date': xSdkDate,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: bodyText,
    });
  } catch (error) {
    throw createCliError('NETWORK_ERROR', `网络请求失败：${error.message}`, 3);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw createCliError(
      'NETWORK_ERROR',
      `响应解析失败：${error.message}`,
      3,
      { http_status: response.status },
    );
  }
  if (!response.ok) {
    throw createCliError(
      data?.error_code || `HTTP_${response.status}`,
      data?.error_msg || `API 返回 HTTP ${response.status}`,
      1,
      { http_status: response.status, api_response: data },
    );
  }
  return pickIssue(data);
}


/**
 * 功能：执行 CLI 并返回可测试的输出结果。
 * 输入：argv 为命令参数，deps 可注入 env、fetchImpl 和 now。
 * 输出：包含 exitCode、stdout、stderr 的对象。
 */
async function runCLI(argv, deps = {}) {
  const jsonRequested = argv.includes('--json');
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) {
      return { exitCode: 0, stdout: printHelp(parsed.help), stderr: '' };
    }
    const config = loadConfig(deps.env || process.env);
    const issue = await createIssue({
      config,
      input: parsed.input,
      fetchImpl: deps.fetchImpl || fetch,
      now: deps.now || new Date(),
    });
    if (parsed.json) {
      return { exitCode: 0, stdout: `${JSON.stringify(issue, null, 2)}\n`, stderr: '' };
    }
    return {
      exitCode: 0,
      stdout: `Created ${issue.tracker} #${issue.id}: ${issue.name}\n`,
      stderr: '',
    };
  } catch (error) {
    const exitCode = error.exitCode || 1;
    if (jsonRequested) {
      const payload = {
        error: true,
        error_code: error.code || 'UNEXPECTED_ERROR',
        error_msg: error.message,
        ...(error.details || {}),
      };
      return { exitCode, stdout: '', stderr: `${JSON.stringify(payload, null, 2)}\n` };
    }
    return {
      exitCode,
      stdout: '',
      stderr: `ERROR [${error.code || 'UNEXPECTED_ERROR'}]: ${error.message}\n`,
    };
  }
}


/**
 * 功能：运行 CLI 主入口并写入标准输出、标准错误和退出码。
 * 输入：无。
 * 输出：无返回值；通过 process.exitCode 表示结果。
 */
async function main() {
  const result = await runCLI(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}


if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  main();
}


export {
  TRACKER_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  parseArgs,
  printHelp,
  sha256Hex,
  hmacSHA256Hex,
  formatSdkDate,
  buildSignature,
  loadConfig,
  createIssueBody,
  pickIssue,
  createIssue,
  runCLI,
  main,
};
