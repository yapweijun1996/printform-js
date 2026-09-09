import { createPi04DirectHarness, createPi04Environment } from "./qualification-env.js";
import { PI04_CANARY } from "./qualification-env.js";

function errorCode(error) { return error?.code || "PI04_CASE_FAILED"; }

export async function runPi04DirectCommitRecovery() {
  const environment = await createPi04Environment();
  const providerKey = "PI04-COMMIT-SYNTHETIC-KEY";
  let qualification;
  let lostResponse = false;
  try {
    qualification = await createPi04DirectHarness(environment, {
      profile: { id: "pi04-direct-commit", provider: "custom", endpoint: "https://provider.test/v1", model: "pi04-commit", apiVariant: "chat" },
      apiKey: providerKey
    });
    const originalExecuteHuman = environment.privateGateway.executeHuman;
    environment.privateGateway.executeHuman = async (name, input = {}) => {
      const response = await originalExecuteHuman(name, input);
      if (name === "apply_changes" && response?.ok && !lostResponse) {
        lostResponse = true;
        throw Object.assign(new Error("Synthetic apply response lost."), { code: "COMMIT_RESPONSE_LOST" });
      }
      return response;
    };
    const run = await qualification.host.run("Preview one valid table A edit for commit recovery.");
    const proposals = qualification.host.proposals();
    const applied = await qualification.host.applyPendingProposal(proposals[0]?.proposalId);
    const safeOutput = JSON.stringify({ run, applied, calls: environment.calls(), events: qualification.host.events() });
    return {
      provider: "openai-compatible-chat-commit-recovery", run, applied, lostResponse,
      proposalCount: proposals.length, revision: environment.bus.revision,
      revisionEntries: environment.bus.history.entries.map((entry) => entry.revision),
      calls: environment.calls(), sessionMode: environment.sessionMode(), candidateRenderCount: environment.candidateRenderCount(),
      noCanaryInQualificationOutput: !safeOutput.includes(PI04_CANARY),
      noProviderCredentialInQualificationOutput: !safeOutput.includes(providerKey), errors: []
    };
  } catch (error) {
    return { failed: true, error: { code: errorCode(error), message: error?.message || String(error) } };
  } finally {
    await qualification?.host.dispose();
    qualification?.adapter.dispose();
    await environment.close();
  }
}
