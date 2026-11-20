import path from 'node:path';
import {parseUpstreamJson,readUpstreamFile} from './studio-v3-upstream-evidence.mjs';
import {verifyReleasePair} from './studio-v3-release-verification.mjs';

try {
  const [oldRoot,nextRoot,pinsFile,...extra] = process.argv.slice(2);
  if (!oldRoot || !nextRoot || !pinsFile || extra.length) {
    throw new Error('Usage: studio-v3-verify-release-pair.mjs OLD_SITE_DIST NEXT_SITE_DIST OBSERVED_PINS_JSON');
  }
  const file = path.resolve(pinsFile), pins = parseUpstreamJson(readUpstreamFile(path.dirname(file),path.basename(file)));
  console.log(JSON.stringify(verifyReleasePair(oldRoot,nextRoot,pins),null,2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
