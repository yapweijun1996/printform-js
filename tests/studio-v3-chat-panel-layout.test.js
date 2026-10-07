import {beforeEach,describe,it,expect,vi} from 'vitest';
import {AIElementTags} from '../studio-v3/ai-element-tags.js';
import {html,setup} from './support/chat-panel.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
const withWidth=(width,work)=> {const before=window.innerWidth;window.innerWidth=width;try {return work();} finally {window.innerWidth=before;}};

describe('empty state',()=> {
  it('asks what to change and puts the starting actions in the middle, not under the conversation',()=> {
    const {panel}=setup(),log=panel.node('[data-ai-log]');
    expect(log.querySelector('h3').textContent).toBe('What would you like to change?');
    const chips=[...log.querySelectorAll('[data-ai=prompt]')];
    expect(chips.map(button=>button.textContent)).toEqual(['Improve typography','Make spacing tighter','Use red accents','Check font sizes']);
    chips.forEach(button=>expect(button.dataset.prompt.length).toBeGreaterThan(10));
    expect(panel.node('.ai-composer [data-ai=prompt]')).toBeNull();
    expect(log.querySelector('[data-ai=attach]').textContent).toContain('Attach reference');
  });

  it('shows the Ask, Preview on page, Apply flow up front',()=> {
    const {panel}=setup(),flow=[...panel.node('[data-ai-log]').querySelectorAll('.ai-flow li')].map(item=>item.textContent);
    expect(flow).toEqual(['Ask','Preview on page','Apply (Undo anytime)']);
  });

  it('a starting action fills the message box and Attach reference opens the file picker',()=> {
    const {panel}=setup(),log=panel.node('[data-ai-log]'),pick=vi.spyOn(panel.referenceFiles.input,'click').mockImplementation(()=>{});
    log.querySelector('[data-ai=prompt]').click();
    expect(panel.node('#ai-prompt').value).toBe(log.querySelector('[data-ai=prompt]').dataset.prompt);
    log.querySelector('[data-ai=attach]').click();
    expect(pick).toHaveBeenCalledTimes(1);expect(panel.referenceFiles.root.open).toBe(true);
  });

  it('leaves once the conversation starts',async()=> {
    const {panel}=setup();await panel.send();
    expect(panel.node('[data-ai-log] .ai-welcome')).toBeNull();
  });
});

describe('scope bar',()=> {
  const selected=panel=> {
    panel.elementTags=new AIElementTags({bus:()=>panel.getBus(),selection:()=>'label-customer-ship',onChange:()=>panel.share()});
    panel.elementTags.add('label-customer-ship');panel.contextChanged();
  };
  it('sits above the conversation, outside the composer, so it is the first thing read',()=> {
    const {panel}=setup(),bar=panel.node('[data-ai-scope]');
    expect(bar.closest('form')).toBeNull();expect(bar.nextElementSibling).toBe(panel.node('[data-ai-log]'));
  });
  it('says the whole form can change, with a warning treatment hook',()=> {
    const {panel}=setup(),bar=panel.node('[data-ai-scope]');
    expect(bar.textContent).toMatch(/^Scope: Whole form/);expect(bar.dataset.scope).toBe('whole');
  });
  it('names the limit once elements are referenced',()=> {
    const {panel}=setup(),bar=panel.node('[data-ai-scope]');selected(panel);
    expect(bar.textContent).toMatch(/^Scope: 1 selected element/);expect(bar.dataset.scope).toBe('selected');
  });
  it('tells a narrow screen how to select, since the panel covers the paper',()=> {
    const {panel}=setup(),bar=panel.node('[data-ai-scope]');
    withWidth(600,()=>{panel.contextChanged();expect(bar.textContent).toContain('Close this panel');});
    withWidth(1400,()=>{panel.contextChanged();expect(bar.textContent).toContain('press Add to chat');expect(bar.textContent).not.toContain('Close this panel');});
  });
});

describe('header and composer',()=> {
  it('has one way to close: no separate Back button that does the same thing',()=> {
    const {panel}=setup();
    expect(panel.node('[data-ai=paper]')).toBeNull();expect(panel.node('[data-ai=close]')).not.toBeNull();
  });
  it('invites any change, not only fonts and colours',()=> {
    const {panel}=setup();
    expect(panel.node('#ai-prompt').placeholder).toBe('Describe what you want to change…');
  });
  it('names the Preview button by what it does',async()=> {
    const before=window.innerWidth;window.innerWidth=600;
    try {
      const {panel}=setup();await panel.send();
      expect(panel.node('[data-ai=preview]').textContent).toBe('Preview on page');
    } finally {window.innerWidth=before;}
  });
});
