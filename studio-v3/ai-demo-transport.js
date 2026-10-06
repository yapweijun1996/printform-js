import { imageCapability, modelCapabilityFacts } from './model-capabilities.js';
import { createDemoGatewaySession } from '../studio-v2/ui/agent-demo-gateway.js';
import { DEMO_CONFIG, isDemoAlias } from './ai-gateway-config.js';
import { classifyFailure } from './ai-gateway-errors.js';
import { assertImageParts, buildResponsesBody, responsesResult } from './ai-responses-wire.js';
import { fail } from './ai-edits.js';
import { CHAT_PROMPT } from './ai-chat-protocol.js';

const assertDispatch = Symbol('assertDemoDispatch');
export function createDemoTransport({fetchImpl = (...args) => fetch(...args),now} = {}) {
  let imageModels = new Set(), capabilityFacts=[], discoveryGeneration=0;
  const resetCapabilities=()=>{imageModels.clear();capabilityFacts=[];return ++discoveryGeneration;};
  const session = createDemoGatewaySession({now,fetchImpl:async (url,options) => {
    // Recheck after session acquisition/refresh; keep the guard off the wire.
    const {[assertDispatch]:assertCurrent,...init}=options;
    assertCurrent?.();
    let response;
    try { response = await fetchImpl(url,init); }
    catch (error) { throw error?.code || ['AbortError','TimeoutError'].includes(error?.name) ? error : fail('DEMO_NETWORK_UNREACHABLE'); }
    // Session failures are named here; unknown ones fall through to the shared session error.
    // Model requests are classified in json(), after the session's single 401 refresh.
    if (String(url).endsWith('/demo/session') && !response.ok) {
      const code = await classifyFailure(response);
      if (!['DEMO_REQUEST_FAILED','DEMO_SESSION_EXPIRED'].includes(code)) throw fail(code);
    }
    return response;
  }});
  async function json(path, options) {
    const response = await session.fetch(`${DEMO_CONFIG.apiBase}/${path}`,options);
    if (!response.ok) throw fail(await classifyFailure(response));
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let source = '';
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        source += decoder.decode(part.value,{stream:true});
        if (source.length > DEMO_CONFIG.responseLimitChars) throw fail('DEMO_RESPONSE_LIMIT');
      }
      source += decoder.decode(); return JSON.parse(source);
    } catch (error) { if (error.code || error.name === 'AbortError') throw error; throw fail('MALFORMED_PROPOSAL'); }
    finally { await reader.cancel().catch(()=>{}); }
  }
  return {
    clear:() => { resetCapabilities(); session.clear(); },
    // Completed UI actions drop tokens while retaining the latest model facts.
    clearSession:() => session.clear(),
    supportsImages:alias => imageModels.has(alias),
    capabilityDiagnostics:()=>structuredClone(capabilityFacts),
    async discover(signal) {
      const generation=resetCapabilities();
      const payload = await json('models',{method:'GET',signal});
      signal?.throwIfAborted();
      if(generation!==discoveryGeneration)throw fail('DEMO_MODEL_UNAVAILABLE');
      const advertised = Array.isArray(payload?.data) ? payload.data.filter(model=>isDemoAlias(model?.id)) : [];
      const aliases = [...new Set(advertised.map(model=>model.id))].slice(0,DEMO_CONFIG.maxAliases), models = advertised.filter(model=>aliases.includes(model.id));
      if (!aliases.length) throw fail('DEMO_MODEL_UNAVAILABLE');
      imageModels = new Set(aliases.filter(alias=>models.filter(model=>model.id===alias).every(imageCapability)));
      capabilityFacts=models.map(model=>({alias:model.id,facts:modelCapabilityFacts(model)}));
      return aliases;
    },
    async plan(alias, request, signal, media = []) {
      if (!isDemoAlias(alias)) throw fail('DEMO_MODEL_UNAVAILABLE');
      let guard;
      if (media.length) {
        if (!imageModels.has(alias)) throw fail('DEMO_IMAGE_CAPABILITY_UNVERIFIED');
        const generation=discoveryGeneration;
        guard=()=>{if(generation!==discoveryGeneration || !imageModels.has(alias))throw fail('DEMO_IMAGE_CAPABILITY_UNVERIFIED');};
        assertImageParts(media);
      }
      // One closed Demo wire contract for text and images; local tools and tokens never enter it.
      const body = buildResponsesBody({alias,system:CHAT_PROMPT,request,media});
      return responsesResult(await json('responses',{method:'POST',signal,headers:{'content-type':'application/json'},body,[assertDispatch]:guard}));
    }
  };
}
