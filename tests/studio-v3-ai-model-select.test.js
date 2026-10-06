import { describe,it,expect,beforeEach } from 'vitest';
import { fillModels,orderAliases,showAlias } from '../studio-v3/ai-model-select.js';
let select;
const values = () => [...select.options].map(option=>option.value);
beforeEach(()=> { document.body.innerHTML='<select id="m"><option value="demo-auto">demo-auto</option></select>';select=document.querySelector('#m'); });
describe('model select',()=> {
  it('puts the routing alias first and keeps the gateway order for the rest',()=> {
    expect(orderAliases(['demo-groq','demo-gemini','demo-auto','demo-openai-mini'])).toEqual(['demo-auto','demo-groq','demo-gemini','demo-openai-mini']);
    expect(orderAliases(['demo-b','demo-a'])).toEqual(['demo-b','demo-a']);
  });
  it('rebuilds the options and keeps the current choice when it is still offered',()=> {
    expect(fillModels(select,['demo-groq','demo-auto'])).toBe(true);expect(values()).toEqual(['demo-auto','demo-groq']);expect(select.value).toBe('demo-auto');
    select.value='demo-groq';expect(fillModels(select,['demo-auto','demo-groq','demo-gemini'])).toBe(true);expect(select.value).toBe('demo-groq');
  });
  it('reports a vanished choice and shows the first offered alias',()=> {
    select.value='demo-auto';expect(fillModels(select,['demo-groq','demo-gemini'])).toBe(false);expect(values()).toEqual(['demo-groq','demo-gemini']);expect(select.value).toBe('demo-groq');
  });
  it('never parses an alias as markup',()=> {
    fillModels(select,['<img src=x onerror=alert(1)>']);const option=select.options[0];
    expect(option.children).toHaveLength(0);expect(option.textContent).toBe('<img src=x onerror=alert(1)>');expect(select.querySelector('img')).toBeNull();
  });
  it('shows a restored alias once without duplicating it',()=> {
    showAlias(select,'demo-groq');showAlias(select,'demo-groq');showAlias(select,'demo-auto');
    expect(values()).toEqual(['demo-auto','demo-groq']);expect(select.value).toBe('demo-auto');
  });
});
