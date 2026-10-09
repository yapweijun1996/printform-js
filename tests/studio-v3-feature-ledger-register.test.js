import {describe,it,expect} from 'vitest';
import {read,ledgerRows} from './support/feature-ledger.js';
import {FAMILIES,readRegister,validateRegister} from '../scripts/studio-v3-task-register.mjs';

describe('Studio v3 feature ledger and task register link', () => {
  const capabilityIds = new Set(ledgerRows().map(row => row.id));

  it('validates the committed task register against ledger capability IDs', () => {
    expect(validateRegister(readRegister(),{capabilityIds})).toEqual([]);
  });
  it('rejects a task capability that is not a ledger ID', () => {
    const register = readRegister();
    register.tasks.rows.push({id:'T-qa-01',family:'qa',title:'',essential:'',holdout:'no',capabilities:'printform.not.real',preconditions:'',actions:'',
      expected:'',failure_oracle:'',oracle_type:'',oracle_owner:'',input_digest:'',status:'draft'});
    expect(validateRegister(register,{capabilityIds})).toContain('task T-qa-01: unknown capability printform.not.real');
  });
  it('lists exactly the register families in the ledger view', () => {
    const view = read('docs/STUDIO_V3_FEATURE_LEDGER.md').split('## Task families')[1].split('## Open items')[0];
    for (const family of FAMILIES) expect(view,family).toContain(`\`${family}\``);
  });
});
