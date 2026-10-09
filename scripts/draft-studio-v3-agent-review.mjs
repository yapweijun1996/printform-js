// Prints skeleton dispositions for every pending agent change, bound to current digests; fill them into
// docs/studio-v3-agent-release/review.json. Usage: node scripts/draft-studio-v3-agent-review.mjs
import { generateAgentPackage } from './generate-studio-v3-agent.mjs';
import { readReleaseState, draftDispositions } from './studio-v3-agent-review.mjs';

const state = readReleaseState();
console.log(JSON.stringify(draftDispositions(generateAgentPackage({baseline:state.baseline,baselineIndex:state.baselineIndex})),null,2));
