// A read-only test sampler for native rendered data. Recreated srcdoc frames
// can lose Firefox's later Playwright execution context even after they render.
export async function observeNativePreview(page,measure,options=null) {
  await page.addInitScript(({sample,options})=>{
    if (window !== window.top) return;
    const source = 'printform-native-preview-test';
    const state = window.__nativePreviewTest = {generation:0,snapshot:null};
    window.addEventListener('message',event=>{
      const frame = document.querySelector('#preview-frame'), report = event.data;
      if (event.source === frame?.contentWindow && report?.source === source && report.generation === state.generation) {
        state.snapshot = report.snapshot;
      }
    });

    const prototype = HTMLIFrameElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype,'srcdoc');
    Object.defineProperty(prototype,'srcdoc',{...descriptor,set(html) {
      if (this.id !== 'preview-frame') return descriptor.set.call(this,html);
      state.generation += 1;
      state.snapshot = null;
      const nonce = html.match(/<script\b[^>]*\bnonce="([A-Za-z0-9+/=]+)"/)?.[1];
      const end = html.lastIndexOf('</body>');
      if (nonce && end !== -1 && html.includes("source:'printform-studio-v3-preview'")) {
        const observer = `<script nonce="${nonce}">window.addEventListener('printform:rendered',()=>{
          const snapshot = (${sample})(${JSON.stringify(options)});
          parent.postMessage({source:${JSON.stringify(source)},generation:${state.generation},snapshot},'*');
        },{once:true});</script>`;
        html = html.slice(0,end) + observer + html.slice(end);
      }
      return descriptor.set.call(this,html);
    }});
  },{sample:measure.toString(),options});
}

export const readNativePreview = page=>page.evaluate(()=>window.__nativePreviewTest?.snapshot ?? null);
