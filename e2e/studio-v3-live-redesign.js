// Opt-in only. The actual HTTP requests originate in a fresh browser page at
// the registered public origin. No Origin override or credential extraction.
export async function publicDemoPlanner(context) {
  const page = await context.newPage();
  await page.goto('https://yapweijun1996.github.io/printform-js/studio-v3/');
  await page.evaluate(async()=> {
    const gateway = await import('/printform-js/studio-v2/ui/agent-demo-gateway.js');
    globalThis.printformRegressionSession = gateway.createDemoGatewaySession();
    globalThis.printformRegressionEndpoint = gateway.DEMO_GATEWAY_ENDPOINT;
  });
  return async wire => page.evaluate(async ({model,messages})=> {
    const response = await globalThis.printformRegressionSession.fetch(
      `${globalThis.printformRegressionEndpoint}/chat/completions`, {
        method:'POST',headers:{'content-type':'application/json'},
        signal:AbortSignal.timeout(45000),body:JSON.stringify({model,stream:false,messages})
      });
    if (!response.ok) throw new Error(`Public demo HTTP ${response.status}`);
    return response.json();
  },{model:wire.model,messages:wire.messages});
}
