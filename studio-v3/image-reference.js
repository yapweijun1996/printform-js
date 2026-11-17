import { contractError } from './ai-authoring-contract.js';

const number=(value,min,max)=>typeof value==='number' && Number.isFinite(value) && value>=min && value<=max;
export function validateImageReference(value,assets,label) {
  if (typeof value.assetId!=='string' || !/^[a-z0-9-]{1,60}$/.test(value.assetId) || !assets.has(value.assetId)) throw new Error(`${label} must reference an existing embedded raster asset.`);
  if (!number(value.width,8,400) || !number(value.height,8,200)) throw new Error(`${label} dimensions must be 8–400px wide and 8–200px high.`);
  if (value.fit!==undefined && !['contain','cover'].includes(value.fit)) throw new Error('Unsupported image fit.');
}
export function validateLogoReference(value,assets) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!['assetId','width','height','fit'].includes(key))) throw new Error('Unsupported logo property.');
  validateImageReference(value,assets,'Logo');
}
// References only existing assets. Import/byte validation and disclosure remain separate.
export function logoReferenceChange(design,value) {
  const assets=new Set((design.assets || []).map(asset=>asset.id));
  if (value!==null && !assets.has(value?.assetId)) throw contractError('LOGO_ASSET_UNAVAILABLE');
  if (value!==null) try { validateLogoReference(value,assets); } catch(error) {
    throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${error.message}`),{code:'UNSAFE_PROPOSAL'});
  }
  const next=structuredClone(design);next.logo=structuredClone(value);
  return {design:next,changes:[{target:'header-logo',property:'logo',before:design.logo,after:value}],diagnostics:[]};
}
