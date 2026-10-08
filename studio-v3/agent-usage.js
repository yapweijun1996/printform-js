// Unknown consumption is never a zero-token turn. A total can be derived only from two valid component counts.
const tokenCount = value => Number.isSafeInteger(value) && value >= 0;
const count = value => tokenCount(value) ? value : null;
export function agentUsage(usage) {
  const raw = [usage?.prompt_tokens,usage?.completion_tokens,usage?.total_tokens];
  const [input,output,reported] = raw.map(count);
  const sum = input !== null && output !== null ? count(input + output) : null;
  let total = reported;
  if (raw[2] == null) total = sum;
  if (raw.some(value=>value != null && !tokenCount(value)) ||
      (input !== null && output !== null && (sum === null || (reported !== null && sum !== reported))) ||
      (total !== null && [input,output].some(value=>value !== null && value > total))) total = null;
  return {input,output,total};
}

export function addAgentUsage(totals,usage) {
  for (const key of ['input','output','total']) {
    totals[key] = totals[key] !== null && usage[key] !== null ? count(totals[key] + usage[key]) : null;
  }
}
