import { expect, test } from "@playwright/test";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

test("keeps old Synthetic sessions but blocks new Real session persistence", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const result = await page.evaluate(async () => {
    const { AgentSessionManager } = await import("/studio-v2/ui/agent-sessions.js");
    const { classifyRealDocument, classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
    const synthetic = new AgentSessionManager({ dataPolicy: classifySyntheticDocument("session-policy-doc") });
    const oldRecord = await synthetic.create("SESSION-CANARY-SYNTHETIC");
    const beforeSwitch = await synthetic.list();
    synthetic.setDataPolicy(classifyRealDocument("session-policy-doc"));
    const newRecord = await synthetic.create("SESSION-CANARY-REAL");
    const afterSwitch = await synthetic.list();
    return { oldRecord, newRecord, beforeSwitch, afterSwitch };
  });
  const storage = await readClientStorage(page);
  const persisted = JSON.stringify(storage.indexedDb);
  expect(result.beforeSwitch).toEqual([expect.objectContaining({ label: "SESSION-CANARY-SYNTHETIC" })]);
  expect(result.afterSwitch).toEqual([expect.objectContaining({ label: "SESSION-CANARY-REAL" })]);
  expect(persisted).toContain("SESSION-CANARY-SYNTHETIC");
  expect(persisted).not.toContain("SESSION-CANARY-REAL");
});
