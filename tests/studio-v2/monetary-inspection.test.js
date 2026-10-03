import {describe,it,expect,vi,afterEach} from 'vitest';
import {inspectMonetaryTokens} from '../../studio-v2/core/monetary-inspection.js';
import {safeRunDiagnostics} from '../../studio-v3/ai-inspection.js';
const rect=(left,top,width=80,height=14)=>({left,top,right:left+width,bottom:top+height,width,height});
function documentWithMoney(rects,labelRects=[]) {
  document.body.innerHTML='<div class="printform_page"><div class="field"><span data-v3-role="label">Long legitimate\nlabel</span><span data-pf-format="currency">RM 12,150.00</span></div></div>';
  const owner=document.querySelector('.field');owner.getBoundingClientRect=()=>rect(0,0,200,50);
  vi.spyOn(document,'createRange').mockImplementation(()=>({node:null,selectNodeContents(n){this.node=n;},getClientRects(){return this.node.dataset.v3Role==='label' ? labelRects : rects;}}));
  return document;
}
describe('financial readability acceptance',()=> {
  afterEach(()=>vi.restoreAllMocks());
  it('accepts coherent values and legitimate multiline labels',()=>expect(inspectMonetaryTokens(documentWithMoney([rect(100,0)],[rect(0,0,70),rect(0,16,70)]))).toEqual([]));
  it.each([
    [[rect(100,0),rect(100,16)],[]],
    [[rect(170,0)],[]],
    [[rect(100,0)],[rect(80,0,70)]]
  ])('rejects wrapping, cell overflow and label overlap', (rs,labels)=>expect(inspectMonetaryTokens(documentWithMoney(rs,labels))).toHaveLength(1));
  it('passes a specific bounded repair code without amounts or labels',()=> {
    const result=safeRunDiagnostics({errors:[{code:'MONETARY_TOKEN_UNREADABLE',message:'RM 12,150.00'}]},{});
    expect(result.errors).toEqual(['MONETARY_TOKEN_UNREADABLE']);expect(JSON.stringify(result)).not.toContain('12,150');
  });
});
