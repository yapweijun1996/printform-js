import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const html = fs.readFileSync("studio-v2/index.html", "utf8");
const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const expected = JSON.parse(fs.readFileSync("scripts/vendor/agrun-v4/exports.json", "utf8"));
let baseline;
const monitor = `window.__csp=[];addEventListener('securitypolicyviolation',e=>__csp.push({directive:e.effectiveDirective,blockedURI:e.blockedURI}));`;
const exercise = `
(async()=>{
 const a=window.Agrun, types=Object.fromEntries(Object.entries(a).map(([k,v])=>[k,typeof v]));
 const runtime=a.createRuntime({sessionStore:a.createInMemorySessionStore(),globalMemory:{enabled:false}});
 const session=await runtime.createSession({id:'synthetic-csp-session'});
 const reopened=await runtime.openSession('synthetic-csp-session');
 let badAction=false,badStore=false,badResponse=false;
 try{a.defineAction({name:'invalid'});}catch{badAction=true;}
 try{a.createInMemorySessionStore({maxSessions:0});}catch{badStore=true;}
 const request={model:'gpt-synthetic',apiKey:'synthetic-fixture-only',apiVariant:'responses',prompt:'synthetic',timeoutMs:1000};
 let calls=0;
 const reply={id:'fixture-response',created_at:1770000000,model:'gpt-synthetic',output:[{type:'message',role:'assistant',id:'fixture-message',content:[{type:'output_text',text:'synthetic schema accepted',annotations:[]}]}],usage:{input_tokens:8,output_tokens:2,total_tokens:10}};
 const valid=await a.requestOpenAIChatCompletion(request,async()=>{calls++;return new Response(JSON.stringify(reply),{status:200,headers:{'content-type':'application/json'}});});
 try{await a.requestOpenAIChatCompletion(request,async()=>{calls++;return new Response(JSON.stringify({output:'invalid-shape'}),{status:200,headers:{'content-type':'application/json'}});});}catch{badResponse=true;}
 window.__result={types,runtimeMethods:Object.keys(runtime).sort(),sessionMethods:Object.keys(session).sort(),reopenedMethods:Object.keys(reopened).sort(),badAction,badStore,badResponse,text:valid.text,calls};
})().catch(e=>window.__failure=String(e.stack||e));`;

test("preserves the full V4 interface and schema behavior under the unchanged strict production CSP", async ({ page }, testInfo) => {
  // Native Node loads the build recipe; Playwright's CommonJS transform must
  // not rewrite the recipe's import.meta or its native ESM build-tool imports.
  baseline ||= execFileSync(process.execPath, ["--input-type=module", "-e",
    "import {buildAgrun} from './scripts/agrun-source-build.mjs';process.stdout.write(await buildAgrun({jitless:false}));"
  ], { maxBuffer: 8 * 1024 * 1024 });
  const variants = {
    originalSource: await baseline,
    cspSafe: fs.readFileSync("studio-v2/vendor/agrun.min.js")
  };
  const evidence = {};
  for (const [kind, bytes] of Object.entries(variants)) {
    const errors = [];
    const pageErrors = [];
    const listen = (message) => { if (message.type() === "error") errors.push(message.text()); };
    const listenPage = (error) => pageErrors.push(error.message);
    page.on("console", listen);
    page.on("pageerror", listenPage);
    await page.route("**/agrun-csp-probe/**", (route) => {
      const filename = new URL(route.request().url()).pathname.split("/").at(-1);
      const bodies = { "monitor.js": monitor, "runtime.js": bytes, "exercise.js": exercise };
      const body = bodies[filename] || `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><link rel="icon" href="data:,"><title>Fixed V4 source probe</title></head><body><script src="./monitor.js"></script><script src="./runtime.js"></script><script src="./exercise.js"></script></body></html>`;
      return route.fulfill({ status: 200, contentType: filename.endsWith(".js") ? "application/javascript" : "text/html", body });
    });
    await page.goto(`/agrun-csp-probe/${kind}.html`);
    await page.waitForFunction(() => window.__result || window.__failure);
    expect(await page.evaluate(() => window.__failure || null)).toBeNull();
    const result = await page.evaluate(() => ({ result: window.__result, violations: window.__csp }));
    evidence[kind] = { ...result, errors, pageErrors };
    expect(pageErrors).toEqual([]);
    expect(result.result.types).toEqual(expected);
    expect(result.result).toMatchObject({ badAction: true, badStore: true, badResponse: true, text: "synthetic schema accepted", calls: 2 });
    expect(result.result.runtimeMethods).toEqual(expect.arrayContaining(["createSession", "openSession", "runStream"]));
    if (kind === "originalSource") expect(result.violations.some((entry) => entry.blockedURI === "eval")).toBe(true);
    else { expect(result.violations).toEqual([]); expect(errors).toEqual([]); }
    page.off("console", listen);
    page.off("pageerror", listenPage);
    await page.unroute("**/agrun-csp-probe/**");
  }
  expect(evidence.cspSafe.result).toEqual(evidence.originalSource.result);
  await testInfo.attach("fixed-v4-strict-csp.json", { body: JSON.stringify({ csp, evidence }, null, 2), contentType: "application/json" });
});
