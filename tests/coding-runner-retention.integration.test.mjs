// @vitest-environment node
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import { expect, it } from 'vitest';
import { sourceRunnerBrowser } from './support/source-runner-browser.mjs';
import { runnerSourceHash } from '../coding-runner/identity.mjs';
import { DEFAULT_IMAGE, LABEL } from '../coding-runner/policy.mjs';
import { createCodingServer } from '../coding-runner/server.mjs';

const docker = promisify(execFile);
const limits = { idleMs: 15_000, tokenMs: 60_000 };
const releaseIdentity = { release: 'synthetic-ttl', contractHash: 'contract', knowledgeHash: 'knowledge', packageHash: 'package' };
const artifactText = JSON.stringify({
  format: 'printform-operation-artifact', version: 1, summary: 'Fictional TTL fixture',
  operations: [{ type: 'set_heading', value: 'FICTIONAL RETENTION PROBE' }],
});
const artifactDigest = createHash('sha256').update(artifactText).digest('hex');
const buildOutput = 'Fictional retention build completed';
const build = `import { writeFileSync } from 'node:fs';
writeFileSync('artifact.json', ${JSON.stringify(artifactText)});
console.log(${JSON.stringify(buildOutput)});
`;

async function inventory(label) {
  const [containers, volumes] = await Promise.all(['container', 'volume'].map(async (kind) => {
    const { stdout } = await docker('docker', [
      kind, 'ls', ...(kind === 'container' ? ['--all'] : []), '--quiet',
      '--filter', `label=${LABEL}.managed=true`, '--filter', `label=${LABEL}.${label}`,
    ], { timeout: 4_000 });
    return stdout.trim().split('\n').filter(Boolean);
  }));
  return { containers, volumes };
}

function workspaceInventory(workspace) {
  return inventory(`workspace=${workspace.id}`);
}

async function brokerOwner(workspace) {
  const { containers, volumes } = await workspaceInventory(workspace);
  expect(containers).toHaveLength(1);
  expect(volumes).toHaveLength(1);
  const [anchor, volume] = await Promise.all([['container', containers[0]], ['volume', volumes[0]]]
    .map(async ([kind, id]) => {
      const { stdout } = await docker('docker', [kind, 'inspect', id], { timeout: 4_000 });
      const [item] = JSON.parse(stdout);
      return kind === 'container' ? item.Config.Labels : item.Labels;
    }));
  for (const labels of [anchor, volume]) {
    expect(labels[`${LABEL}.managed`]).toBe('true');
    expect(labels[`${LABEL}.workspace`]).toBe(workspace.id);
    expect(labels[`${LABEL}.owner`]).toMatch(/^[0-9a-f-]{36}$/);
  }
  expect(anchor[`${LABEL}.owner`] === volume[`${LABEL}.owner`]).toBe(true);
  return anchor[`${LABEL}.owner`];
}

async function waitForRemoval(workspace, deadline, heartbeat) {
  while (Date.now() < deadline) {
    const { containers, volumes } = await workspaceInventory(workspace);
    if (!containers.length && !volumes.length) return Date.now();
    await heartbeat?.();
    await delay(300);
  }
  throw new Error('Owned Docker resources remained past the probe deadline');
}

it.skipIf(process.env.PF_CODING_INTEGRATION !== '1')(
  'automatically removes only the expired source workspace and denies its prior receipts',
  async () => {
    const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    let transport;
    let companion;
    let owner;
    try {
      transport = await sourceRunnerBrowser(browser);
      companion = createCodingServer({
        origin: transport.origin, port: 0, image: process.env.PF_CODING_IMAGE || DEFAULT_IMAGE, limits,
      });
      const { url, imageDigest, runnerSourceHash: identity } = await companion.listen();
      expect(identity).toBe(runnerSourceHash());
      expect(imageDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      const health = await fetch(`${url}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ limits, imageDigest, runnerSourceHash: identity });

      async function pair() {
        const credentials = await transport.pair(url);
        expect(credentials.runnerSourceHash).toBe(identity);
        return credentials;
      }
      const request = (auth, path, body) => transport.request(url, auth.token, path, body);
      const calls = (workspace) => `/v1/workspaces/${workspace.id}/calls`;
      const receipt = (auth, workspace, callId) => request(auth, `${calls(workspace)}/${callId}`);
      async function create(auth, files) {
        const response = await request(auth, '/v1/workspaces', {
          files, releaseIdentity, documentId: 'synthetic-retention', baseRevision: 3, runId: randomUUID(),
        });
        expect(response.status, response.body.error?.code).toBe(200);
        expect(response.body.imageDigest).toBe(imageDigest);
        return response.body;
      }
      async function call(auth, workspace, operation, args) {
        const accepted = await request(auth, calls(workspace), { operation, expectedRevision: workspace.revision, args });
        expect(accepted.status, accepted.body.error?.code).toBe(202);
        const completed = await receipt(auth, workspace, `${accepted.body.callId}?wait=1`);
        expect(completed.status, completed.body.error?.code).toBe(200);
        expect(completed.body).toMatchObject({ status: 'completed', imageDigest });
        expect(completed.body.error).toBeUndefined();
        workspace.revision = completed.body.afterRevision;
        return completed.body;
      }

      const idlePair = await pair();
      const idleWorkspace = await create(idlePair, [{ path: 'build.mjs', content: build }]);
      const producer = await call(idlePair, idleWorkspace, 'run', { command: 'node build.mjs' });
      expect(producer).toMatchObject({ exitCode: 0, stdout: `${buildOutput}\n` });
      const artifactArgs = { callId: producer.callId, path: 'artifact.json' };
      const artifact = await call(idlePair, idleWorkspace, 'artifacts', artifactArgs);
      expect(artifact.result).toMatchObject({
        buildCallId: producer.callId, content: artifactText, contentDigest: artifactDigest,
      });
      const idleLastAccess = Date.now();
      owner = await brokerOwner(idleWorkspace);

      const livePair = await pair();
      expect(livePair.token !== idlePair.token).toBe(true);
      const note = 'Fictional receipt protected by a separate pairing';
      const liveWorkspace = await create(livePair, [{ path: 'note.txt', content: note }]);
      expect(await brokerOwner(liveWorkspace) === owner).toBe(true);
      const read = await call(livePair, liveWorkspace, 'read', { path: 'note.txt' });
      expect(read.result.content).toBe(note);
      expect(await receipt(livePair, idleWorkspace, artifact.callId)).toMatchObject({
        status: 404, body: { error: { code: 'WORKSPACE_NOT_FOUND' } },
      });

      let lastHeartbeat;
      async function heartbeat() {
        const response = await receipt(livePair, liveWorkspace, read.callId);
        expect(response.status, response.body.error?.code).toBe(200);
        expect(response.body.result.content).toBe(note);
        lastHeartbeat = Date.now();
      }
      await heartbeat();

      // Poll Docker only for the idle workspace. An API read would extend its TTL.
      const idleRemoved = await waitForRemoval(idleWorkspace, idlePair.expiresAt, async () => {
        if (Date.now() - lastHeartbeat > 2_200) await heartbeat();
      });
      expect(idleRemoved).toBeGreaterThanOrEqual(idleLastAccess + limits.idleMs - 100);
      expect(idleRemoved).toBeLessThan(idlePair.expiresAt);
      await delay(100);
      for (const prior of [
        await receipt(idlePair, idleWorkspace, producer.callId),
        await receipt(idlePair, idleWorkspace, artifact.callId),
        await request(idlePair, calls(idleWorkspace), {
          operation: 'artifacts', expectedRevision: idleWorkspace.revision, args: artifactArgs,
        }),
      ]) {
        expect([404, 409]).toContain(prior.status);
        expect(Object.keys(prior.body)).toEqual(['error']);
        expect(['WORKSPACE_CLOSED', 'WORKSPACE_NOT_FOUND']).toContain(prior.body.error.code);
      }
      expect(await brokerOwner(liveWorkspace) === owner).toBe(true);
      await heartbeat();
      while (livePair.expiresAt - Date.now() > 1_700) {
        await delay(Math.min(2_200, livePair.expiresAt - Date.now() - 1_700));
        await heartbeat();
      }

      // Requests can also prune expired tokens. Observe removal before making one.
      expect(lastHeartbeat).toBeLessThan(livePair.expiresAt);
      expect(lastHeartbeat).toBeGreaterThan(livePair.expiresAt - limits.idleMs);
      const tokenRemoved = await waitForRemoval(liveWorkspace, lastHeartbeat + limits.idleMs);
      expect(tokenRemoved).toBeGreaterThanOrEqual(livePair.expiresAt);
      expect(tokenRemoved).toBeLessThan(lastHeartbeat + limits.idleMs);
      const expired = await receipt(livePair, liveWorkspace, read.callId);
      expect(expired).toMatchObject({ status: 401, body: { error: { code: 'AUTH_REJECTED' } } });
      expect(Object.keys(expired.body)).toEqual(['error']);
      expect(await inventory(`owner=${owner}`)).toEqual({ containers: [], volumes: [] });
    } finally {
      try {
        await companion?.close();
        if (owner) expect(await inventory(`owner=${owner}`)).toEqual({ containers: [], volumes: [] });
      } finally {
        try { await transport?.close(); } finally { await browser.close(); }
      }
    }
  },
  150_000,
);
