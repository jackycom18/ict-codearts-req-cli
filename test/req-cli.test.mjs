import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  buildSignature,
  createIssue,
  createIssueBody,
  runCLI,
} from '../req-cli.mjs';


const PROJECT_ID = '0123456789abcdef0123456789abcdef';
const VALID_ARGS = [
  'issue',
  'create',
  'Login page blank',
  '--project-id',
  PROJECT_ID,
  '--tracker',
  '3',
  '--priority',
  '3',
  '--json',
];


test('root help is self-describing', () => {
  const result = spawnSync(process.execPath, ['req-cli.mjs', '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /issue create/);
});


test('create help lists required options and environment variables', () => {
  const result = spawnSync(
    process.execPath,
    ['req-cli.mjs', 'issue', 'create', '--help'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--project-id/);
  assert.match(result.stdout, /--tracker/);
  assert.match(result.stdout, /--priority/);
  assert.match(result.stdout, /CODEARTS_REQ_ENDPOINT/);
});


test('missing required arguments return exit code 2', async () => {
  const result = await runCLI(['issue', 'create', 'Missing flags'], { env: {} });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /--project-id/);
});


test('invalid tracker, severity, project id and date are rejected', async () => {
  for (const args of [
    [...VALID_ARGS.slice(0, 7), '9', ...VALID_ARGS.slice(8)],
    [...VALID_ARGS, '--severity', '99'],
    ['issue', 'create', 'Bad project', '--project-id', 'abc', '--tracker', '3', '--priority', '3'],
    [...VALID_ARGS, '--begin', '2026-02-30'],
  ]) {
    const result = await runCLI(args, { env: {} });
    assert.equal(result.exitCode, 2);
  }
});


test('missing configuration returns exit code 2 before requesting network', async () => {
  let called = false;
  const result = await runCLI(VALID_ARGS, {
    env: {},
    fetchImpl: async () => {
      called = true;
    },
  });
  assert.equal(result.exitCode, 2);
  assert.equal(called, false);
});


test('request body maps optional flags to API fields', async () => {
  const parsed = await runCLI([
    ...VALID_ARGS,
    '--description', 'Open home page is slow',
    '--severity', '12',
    '--status-id', '2',
    '--assigned-to', '42',
    '--begin', '2026-10-27',
  ], {
    env: {
      CODEARTS_REQ_ENDPOINT: 'https://projectman-ext.cn-north-4.myhuaweicloud.com',
      CODEARTS_REQ_AK: 'test-ak',
      CODEARTS_REQ_SK: 'test-sk',
    },
    fetchImpl: async (url, init) => {
      assert.match(url, /\/v4\/projects\/0123456789abcdef0123456789abcdef\/issue$/);
      assert.match(init.headers.Authorization, /^SDK-HMAC-SHA256 Access=test-ak,/);
      const body = JSON.parse(init.body);
      assert.deepEqual(body, {
        name: 'Login page blank',
        tracker_id: 3,
        priority_id: 3,
        status_id: 2,
        description: 'Open home page is slow',
        severity_id: 12,
        assigned_id: 42,
        begin_time: '2026-10-27',
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          issue: {
            id: 101,
            name: 'Login page blank',
            tracker_id: 3,
            priority_id: 3,
            status_id: 2,
          },
        }),
      };
    },
  });
  assert.equal(parsed.exitCode, 0);
  assert.equal(JSON.parse(parsed.stdout).id, 101);
  assert.equal(JSON.parse(parsed.stdout).tracker, 'Bug');
});


test('signature is deterministic for a fixed SDK date', () => {
  const first = buildSignature({
    method: 'POST',
    url: `https://projectman-ext.cn-north-4.myhuaweicloud.com/v4/projects/${PROJECT_ID}/issue`,
    ak: 'test-ak',
    sk: 'test-sk',
    body: JSON.stringify(createIssueBody({
      title: 'Login page blank',
      projectId: PROJECT_ID,
      trackerId: 3,
      priorityId: 3,
      statusId: 1,
    })),
    date: new Date('2026-10-27T00:00:00Z'),
  });
  assert.equal(first.xSdkDate, '20261027T000000Z');
  assert.match(first.authorization, /SignedHeaders=host;x-sdk-date/);
  assert.match(first.authorization, /Signature=[0-9a-f]{64}$/);
});


test('successful API response is mapped to stable JSON fields', async () => {
  const result = await createIssue({
    config: {
      endpoint: 'https://projectman-ext.cn-north-4.myhuaweicloud.com',
      ak: 'test-ak',
      sk: 'test-sk',
    },
    input: {
      title: 'Login page blank',
      projectId: PROJECT_ID,
      trackerId: 3,
      priorityId: 3,
      statusId: 1,
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        issue: {
          id: 101,
          name: 'Login page blank',
          tracker_id: 3,
          priority_id: 3,
          status_id: 1,
        },
      }),
    }),
  });
  assert.deepEqual(result, {
    id: 101,
    name: 'Login page blank',
    tracker: 'Bug',
    priority: 'high',
    status: 'new',
    tracker_id: 3,
    priority_id: 3,
    status_id: 1,
  });
});


test('API errors preserve error_code and use exit code 1', async () => {
  const result = await runCLI(VALID_ARGS, {
    env: {
      CODEARTS_REQ_ENDPOINT: 'https://projectman-ext.cn-north-4.myhuaweicloud.com',
      CODEARTS_REQ_AK: 'test-ak',
      CODEARTS_REQ_SK: 'test-sk',
    },
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error_code: 'PM.DENIED', error_msg: 'denied' }),
    }),
  });
  assert.equal(result.exitCode, 1);
  assert.equal(JSON.parse(result.stderr).error_code, 'PM.DENIED');
});


test('network errors use exit code 3', async () => {
  const result = await runCLI(VALID_ARGS, {
    env: {
      CODEARTS_REQ_ENDPOINT: 'https://projectman-ext.cn-north-4.myhuaweicloud.com',
      CODEARTS_REQ_AK: 'test-ak',
      CODEARTS_REQ_SK: 'test-sk',
    },
    fetchImpl: async () => {
      throw new Error('connection reset');
    },
  });
  assert.equal(result.exitCode, 3);
  assert.match(result.stderr, /NETWORK_ERROR/);
});
