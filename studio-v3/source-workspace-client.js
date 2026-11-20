import { sourceFailure as fail, sourceErrorCode } from './source-workspace-errors.js';

export const SOURCE_RUNNER_URL = 'http://127.0.0.1:4317';
export const SOURCE_PROTOCOL = 'printform-coding-v1';
// 64,000 raw output bytes may expand sixfold in JSON; metadata stays bounded.
const MAX_RESPONSE_BYTES = 1024 * 1024;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const runnerHash = /^[a-f0-9]{64}$/;
const unavailable = () => fail('WORKSPACE_UNAVAILABLE');
const rejected = code => Object.assign(fail(code),{admissionRejected:true});

async function loopbackPermission(permissions,signal) {
  try {
    return await permissions.query({name:'loopback-network'});
  } catch (error) {
    if (signal.aborted || !['TypeError','NotSupportedError'].includes(error?.name)) return;
  }
  try { return await permissions.query({name:'local-network-access'}); } catch {}
}

async function readLoopbackPermission(deadline) {
  const permissions = globalThis.navigator?.permissions;
  if (deadline.aborted || typeof permissions?.query !== 'function') return;
  let abort;
  const interrupted = new Promise(resolve=> { abort = ()=>resolve(); });
  deadline.addEventListener('abort',abort,{once:true});
  try { return await Promise.race([loopbackPermission(permissions,deadline),interrupted]); }
  finally { deadline.removeEventListener('abort',abort); }
}

function checkAdmission(status,deadline,signal) {
  if (deadline.aborted) throw rejected(signal?.aborted ? 'CANCELLED' : 'WORKSPACE_UNAVAILABLE');
  if (status?.state === 'denied') throw rejected('WORKSPACE_LOCAL_NETWORK_DENIED');
}

function runnerUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw unavailable(); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw unavailable();
  return url.origin;
}
async function responseJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw unavailable();
  const decoder = new TextDecoder('utf-8',{fatal:true});
  let size = 0, text = '';
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw fail('WORKSPACE_RESPONSE_LIMIT');
      text += decoder.decode(value,{stream:true});
    }
    text += decoder.decode();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw unavailable();
    if (!response.ok) {
      const code = data.error?.code || data.code;
      throw Object.assign(fail(typeof code === 'string' ? sourceErrorCode(code) : 'WORKSPACE_UNAVAILABLE'),{httpStatus:response.status});
    }
    return data;
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}

// Pairing credentials remain private, in memory. They never become model arguments,
// project fields, recovery snapshots, URLs or localStorage values.
class SourceConnection {
  #token;
  #fetch;
  #revoke;
  #revokeIntent;
  constructor(base,transport,paired) {
    if (paired.protocol !== SOURCE_PROTOCOL || paired.profile !== 'local-docker-node24-source-json-v1' || paired.responseBytes !== MAX_RESPONSE_BYTES ||
      typeof paired.token !== 'string' || paired.token.length < 24 || paired.token.length > 256 || !Number.isFinite(paired.expiresAt) || paired.expiresAt <= Date.now()) throw unavailable();
    this.base = base; this.#fetch = transport; this.#token = paired.token;
    this.expiresAt = paired.expiresAt; this.profile = paired.profile; this.runnerSourceHash = paired.runnerSourceHash;
  }
  #hasCredential() { return Boolean(this.#token) && Date.now() < this.expiresAt; }
  get available() { return !this.#revokeIntent && this.#hasCredential(); }
  async #request(path,{body,signal,intent = crypto.randomUUID(),wait = false,admission = false,revocation = false} = {}) {
    if (!(revocation ? this.#hasCredential() : this.available)) {
      throw admission ? rejected('WORKSPACE_AUTH_EXPIRED') : fail('WORKSPACE_AUTH_EXPIRED');
    }
    const stop = signal ? AbortSignal.any([signal,AbortSignal.timeout(wait ? 65_000 : 15_000)]) : AbortSignal.timeout(wait ? 65_000 : 15_000);
    if (admission) {
      const status = await readLoopbackPermission(stop);
      if (!this.available) throw rejected('WORKSPACE_AUTH_EXPIRED');
      checkAdmission(status,stop,signal);
    }
    const headers = {Authorization:`Bearer ${this.#token}`};
    if (body !== undefined) Object.assign(headers,{'Content-Type':'application/json','x-pf-intent':intent});
    let response;
    try {
      response = await this.#fetch(`${this.base}${path}`,{method:body === undefined ? 'GET' : 'POST',headers,
        ...(body === undefined ? {} : {body:JSON.stringify(body)}),signal:stop,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw unavailable();
    }
    return responseJson(response);
  }
  create(metadata,files,signal,intent) { return this.#request('/v1/workspaces',{body:{...metadata,files},signal,intent,admission:true}); }
  async call(id,operation,args,expectedRevision,signal) {
    if (!identifier(id)) throw fail('WORKSPACE_UNAVAILABLE');
    const root = `/v1/workspaces/${id}`;
    let receipt;
    try { receipt = await this.#request(`${root}/calls`,{body:{operation,expectedRevision,args},signal,admission:true}); }
    catch (error) {
      if (error.httpStatus >= 400 && error.httpStatus < 500 && ['AGENT_ARGUMENTS_INVALID','WORKSPACE_PATH_DENIED','QUOTA_EXCEEDED'].includes(error.code)) error.admissionRejected = true;
      throw error;
    }
    const {callId} = receipt;
    if (!identifier(callId) || receipt.operation !== operation) throw fail('WORKSPACE_RECEIPT_INVALID');
    if (receipt.status === 'running') receipt = await this.#request(`${root}/calls/${callId}?wait=1`,{signal,wait:true});
    if (receipt.callId !== callId || receipt.operation !== operation || receipt.status !== 'completed') throw fail('WORKSPACE_RECEIPT_INVALID');
    return receipt;
  }
  cancel(id) { if (!identifier(id)) throw unavailable(); return this.#request(`/v1/workspaces/${id}/cancel`,{body:{}}); }
  async close(id) {
    if (!identifier(id)) throw unavailable();
    const receipt = await this.#request(`/v1/workspaces/${id}/close`,{body:{}});
    if (receipt.id !== id || receipt.closed !== true) throw fail('WORKSPACE_CLEANUP_FAILED');
    return receipt;
  }
  revoke() {
    if (this.#revoke) return this.#revoke;
    // A dropped response may follow successful server cleanup. The same intent
    // can retrieve that receipt, with the credential restricted to revocation.
    this.#revokeIntent ??= crypto.randomUUID();
    if (!this.#hasCredential()) this.#token = '';
    this.#revoke = this.#request('/v1/revoke',{body:{},intent:this.#revokeIntent,revocation:true}).then(receipt=> {
      if (receipt.revoked !== true || receipt.workspacesClosed !== true) throw fail('WORKSPACE_CLEANUP_FAILED');
      this.#token = '';
      return receipt;
    }).catch(error=> { this.#revoke = null; throw error; });
    return this.#revoke;
  }
}

async function pairingRequest(url,transport,stop,signal,body) {
  checkAdmission(await readLoopbackPermission(stop),stop,signal);
  let response;
  try {
    const payload = body === undefined ? {method:'GET'} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
    response = await transport(url,{...payload,
      signal:stop,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  } catch { if (signal?.aborted) throw signal.reason; throw unavailable(); }
  return responseJson(response);
}

export async function pairSourceRunner(code,{baseURL = SOURCE_RUNNER_URL,transport = globalThis.fetch.bind(globalThis),signal,expectedRunnerSourceHash} = {}) {
  const base = runnerUrl(baseURL);
  if (typeof code !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(code)) throw fail('WORKSPACE_PAIRING_INVALID');
  const stop = signal ? AbortSignal.any([signal,AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000);
  if (expectedRunnerSourceHash !== undefined) {
    if (typeof expectedRunnerSourceHash !== 'string' || !runnerHash.test(expectedRunnerSourceHash)) throw fail('WORKSPACE_RUNTIME_MISMATCH');
    const health = await pairingRequest(`${base}/health`,transport,stop,signal);
    if (health.runnerSourceHash !== expectedRunnerSourceHash) throw fail('WORKSPACE_RUNTIME_MISMATCH');
  }
  const connection = new SourceConnection(base,transport,await pairingRequest(`${base}/v1/pair`,transport,stop,signal,{code}));
  if (expectedRunnerSourceHash !== undefined && connection.runnerSourceHash !== expectedRunnerSourceHash) {
    // The runtime changed after the health check. Revoke the provisional pairing
    // without returning it to the UI or creating any source workspace.
    await connection.revoke().catch(()=> { throw fail('WORKSPACE_PAIRING_REVOKE_UNCONFIRMED'); });
    throw fail('WORKSPACE_RUNTIME_MISMATCH');
  }
  if (typeof connection.runnerSourceHash !== 'string' || !runnerHash.test(connection.runnerSourceHash)) throw unavailable();
  return connection;
}
