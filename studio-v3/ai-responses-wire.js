import { DEMO_CONFIG } from './ai-gateway-config.js';
import { fail } from './ai-edits.js';
const IMAGE = DEMO_CONFIG.image;
const IMAGE_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
// Only png/jpeg/webp base64 data URLs, within the gateway's published limits.
export function assertImageParts(media) {
  const bad = part => Object.keys(part).some(key => !['type','image_url'].includes(key)) || part.type !== 'input_image'
    || typeof part.image_url !== 'string' || part.image_url.length > IMAGE.maxUrlChars || !IMAGE_URL.test(part.image_url);
  if (media.length > IMAGE.maxCount || media.some(bad) || JSON.stringify(media).length > IMAGE.maxTotalBytes) throw fail('UNSAFE_PROPOSAL');
}
// One closed request shape for text and image requests: no tools, no streaming, no Origin.
export function buildResponsesBody({alias, system, request, media = []}) {
  const body = JSON.stringify({model:alias,stream:false,input:[
    {role:'system',content:[{type:'input_text',text:system}]},
    {role:'user',content:[{type:'input_text',text:request},...media]}
  ]});
  if (new TextEncoder().encode(body).length > DEMO_CONFIG.maxBodyBytes) throw fail('UNSAFE_PROPOSAL');
  return body;
}
// Take every output_text and ignore benign unknown items. Tool calls, refusals and
// truncation stay rejected: no tools are offered, so their presence is unexpected authority.
export function extractOutputText(payload) {
  const output = payload?.output;
  if (!Array.isArray(output) || (payload.status !== undefined && payload.status !== 'completed')) throw fail('MALFORMED_PROPOSAL');
  if (output.some(item => /(^|_)call$/.test(String(item?.type)))) throw fail('MALFORMED_PROPOSAL');
  const parts = output.filter(item => item?.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content : []);
  if (parts.some(part => part?.type === 'refusal')) throw fail('MALFORMED_PROPOSAL');
  const text = parts.filter(part => part?.type === 'output_text' && typeof part.text === 'string').map(part => part.text).join('');
  if (!text) throw fail('MALFORMED_PROPOSAL');
  return text;
}
// The harness reads chat-style names; map the Responses usage once, here.
export function responsesUsage(payload) {
  const usage = payload?.usage;
  return {prompt_tokens:usage?.input_tokens,completion_tokens:usage?.output_tokens,total_tokens:usage?.total_tokens};
}
export const responsesResult = payload => ({text:extractOutputText(payload),usage:responsesUsage(payload)});
