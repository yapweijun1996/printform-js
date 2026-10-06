import { DEMO_CONFIG } from './ai-gateway-config.js';
const option = alias => Object.assign(document.createElement('option'),{value:alias,textContent:alias});
// The gateway's routing alias leads the list; everything else keeps the gateway's order.
export const orderAliases = aliases => [...aliases].sort((a,b)=>(b === DEMO_CONFIG.defaultAlias) - (a === DEMO_CONFIG.defaultAlias));
// Rebuild the model <select> from the discovered aliases. Returns true when the
// previous choice is still offered; otherwise the select shows the first alias.
export function fillModels(select, aliases) {
  const wanted = select.value, ordered = orderAliases(aliases);
  select.replaceChildren(...ordered.map(option));
  const kept = ordered.includes(wanted);
  select.value = kept ? wanted : ordered[0];
  return kept;
}
// Show a restored alias until discovery lists the real ones.
export function showAlias(select, alias) {
  if (![...select.options].some(item => item.value === alias)) select.append(option(alias));
  select.value = alias;
}
