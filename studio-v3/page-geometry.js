// Both adapters use the same patch normalization. Whole-design validation remains
// after the atomic batch so coupled paper/margin/profile changes can repair each other.
export function pageGeometryChange(design,patch) {
  const reject=()=>{throw Object.assign(new Error('UNSAFE_PROPOSAL'),{code:'UNSAFE_PROPOSAL'});};
  if (!patch || typeof patch!=='object' || Array.isArray(patch) || Object.keys(patch).some(key=>!['paper','orientation','margins','customSizeMm','printerProfile'].includes(key))) reject();
  const next={...structuredClone(design.page),...structuredClone(patch)};
  if (patch.margins) next.margins={...design.page?.margins,...patch.margins};
  if (patch.paper!==undefined && patch.paper!=='CUSTOM' && patch.customSizeMm===undefined) delete next.customSizeMm;
  if (next.printerProfile===null) delete next.printerProfile;
  const changes=[];
  for (const key of new Set([...Object.keys(design.page || {}),...Object.keys(next)])) {
    if (JSON.stringify(design.page?.[key])!==JSON.stringify(next[key])) changes.push({target:'document',property:`page.${key}`,before:design.page?.[key],after:next[key]});
  }
  return {design:{...structuredClone(design),page:next},changes};
}
