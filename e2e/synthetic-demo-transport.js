import { isInference, responsesReply } from './demo-gateway-fixture.js';
// Explicit browser fetch fixture survives service-worker control in all engines.
// No fixture request is forwarded to the public demo or another external origin.
export async function syntheticDemoTransport(context,replies) {
  const requests=[],unexpected=[];let index=0;
  await context.exposeBinding('__printformSyntheticDemo',(_,url,body)=> {
    const path=new URL(url).pathname;
    if(path.endsWith('/session'))return {status:201,body:{token:'dmo_synthetic123456',expires_in:900}};
    if(path.endsWith('/models'))return {status:200,body:{data:[{id:'demo-fast'},{id:'demo-auto'}]}};
    if(!isInference(path)) {unexpected.push(url);throw new Error('Unexpected fixture endpoint');}
    requests.push(JSON.parse(body));
    return {status:200,body:responsesReply(replies[Math.min(index++,replies.length-1)])};
  });
  await context.addInitScript(()=> {
    const fetchOriginal=window.fetch.bind(window);
    window.fetch=async(input,init)=> {
      const url=new URL(typeof input==='string' ? input : input.url,location.href);
      if(url.origin==='https://gpt.yapweijun1996.com') {
        const result=await window.__printformSyntheticDemo(url.href,init?.body || '');
        return new Response(JSON.stringify(result.body),{status:result.status,headers:{'Content-Type':'application/json'}});
      }
      if(/^https?:$/.test(url.protocol) && url.origin!==location.origin)throw new Error('Unexpected external fetch in synthetic test');
      return fetchOriginal(input,init);
    };
  });
  await context.route('**/*',async route=> {
    const url=new URL(route.request().url());
    if(/^https?:$/.test(url.protocol) && !['127.0.0.1','localhost'].includes(url.hostname)) {
      unexpected.push(url.href);await route.abort('blockedbyclient');
    } else await route.continue();
  });
  return {requests,unexpected};
}
