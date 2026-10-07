import {beforeEach,describe,it,expect,vi} from 'vitest';
import {AIElementTags} from '../studio-v3/ai-element-tags.js';
import {html,setup,scopeText} from './support/chat-panel.js';
beforeEach(()=> {document.documentElement.innerHTML=html.replace(/<!doctype html>/i,'');document.body.inert=false;});
const withWidth=(width,work)=> {const before=window.innerWidth;window.innerWidth=width;try {return work();} finally {window.innerWidth=before;}};

describe('empty state',()=> {
  const drop=(target,files)=> {const event=new Event('drop',{bubbles:true,cancelable:true});event.dataTransfer={files};target.dispatchEvent(event);return event;};
  it('asks what to improve, with an illustration, and keeps the starting actions in the middle',()=> {
    const {panel}=setup(),log=panel.node('[data-ai-log]');
    expect(log.querySelector('h3').textContent).toBe('What would you like to improve?');
    expect(log.querySelector('.ai-hero svg')).not.toBeNull();
    const chips=[...log.querySelectorAll('[data-ai=prompt]')];
    expect(chips.map(button=>button.textContent.trim())).toEqual(['Improve typography','Tighten spacing','Improve alignment','Add red accents']);
    chips.forEach(button=> {expect(button.dataset.prompt.length).toBeGreaterThan(10);expect(button.querySelector('svg')).not.toBeNull();});
    expect(panel.node('.ai-composer [data-ai=prompt]')).toBeNull();
  });

  it('shows the numbered Ask AI, Preview, Apply flow up front',()=> {
    const {panel}=setup(),flow=panel.node('[data-ai-log]').querySelector('ol.ai-flow');
    expect([...flow.querySelectorAll('li')].map(item=>item.textContent)).toEqual(['Ask AI','Preview','Apply']);
  });

  it('a starting action fills the message box and the Attach card opens the file picker',()=> {
    const {panel}=setup(),log=panel.node('[data-ai-log]'),pick=vi.spyOn(panel.referenceFiles.input,'click').mockImplementation(()=>{}),attach=log.querySelector('[data-ai=attach]');
    log.querySelector('[data-ai=prompt]').click();
    expect(panel.node('#ai-prompt').value).toBe(log.querySelector('[data-ai=prompt]').dataset.prompt);
    expect(attach.textContent).toContain('Attach reference');expect(attach.textContent).toContain('PDF, PNG or JPG');expect(attach.querySelector('svg')).not.toBeNull();
    attach.click();
    expect(pick).toHaveBeenCalledTimes(1);expect(panel.referenceFiles.root.open).toBe(true);
  });

  it('a file dropped on the Attach card is read as a reference',()=> {
    const {panel}=setup(),add=vi.spyOn(panel.referenceFiles,'add').mockImplementation(async()=>{}),files=[{name:'fictional.png'}];
    const event=drop(panel.node('[data-ai-log] [data-ai=attach]'),files);
    expect(event.defaultPrevented).toBe(true);expect(add).toHaveBeenCalledWith(files);
  });

  it('does not pick or take a drop while references are locked',()=> {
    const {panel}=setup(),pick=vi.spyOn(panel.referenceFiles.input,'click').mockImplementation(()=>{}),add=vi.spyOn(panel.referenceFiles,'add').mockImplementation(async()=>{});
    panel.referenceFiles.setBusy(true);
    panel.node('[data-ai-log] [data-ai=attach]').click();drop(panel.node('[data-ai-log] [data-ai=attach]'),[{name:'x.png'}]);
    expect(pick).not.toHaveBeenCalled();expect(add).not.toHaveBeenCalled();
  });

  it('starts at the top even if the log was scrolled to its end, so the illustration is not cut off',()=> {
    const {panel}=setup(),log=panel.node('[data-ai-log]');
    Object.defineProperty(log,'scrollHeight',{configurable:true,get:()=>500});log.scrollTop=500;
    panel.update();expect(log.scrollTop).toBe(0);
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
  const choose=(panel,value)=> {const select=panel.node('#ai-scope');select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};
  it('sits above the conversation, outside the composer, so it is the first thing read',()=> {
    const {panel}=setup(),bar=panel.node('[data-ai-scope]');
    expect(bar.closest('form')).toBeNull();expect(bar.nextElementSibling).toBe(panel.node('[data-ai-log]'));
  });
  it('says the whole form can change, promises a preview, and has a warning treatment hook',()=> {
    const {panel}=setup(),bar=panel.node('[data-ai-scope]'),select=panel.node('#ai-scope');
    expect(scopeText(panel)).toBe('Scope: Whole form');expect(bar.dataset.scope).toBe('whole');expect(select.value).toBe('whole');
    expect(select.querySelector('[value=selected]').disabled).toBe(true);
    expect(bar.querySelector('.ai-scope-help').textContent).toContain('Changes will be previewed before applying.');
  });
  it('names the limit once elements are referenced',()=> {
    const {panel}=setup(),bar=panel.node('[data-ai-scope]');selected(panel);
    expect(scopeText(panel)).toBe('Scope: 1 selected element');expect(bar.dataset.scope).toBe('selected');
    expect(panel.node('#ai-scope').value).toBe('selected');expect(panel.node('#ai-scope [value=selected]').disabled).toBe(false);
  });
  it('choosing Whole form drops the references, and the same control stays in place',()=> {
    const {panel}=setup(),select=panel.node('#ai-scope');selected(panel);
    choose(panel,'whole');
    expect(panel.scope()).toEqual({mode:'whole'});expect(scopeText(panel)).toBe('Scope: Whole form');expect(panel.node('#ai-scope')).toBe(select);
  });
  it('cannot be changed while a request is running',()=> {
    const {panel}=setup();panel.busy=true;panel.update();
    expect(panel.node('#ai-scope').disabled).toBe(true);
  });
  it('tells a narrow screen how to select, since the panel covers the paper',()=> {
    const {panel}=setup(),help=panel.node('.ai-scope-help');
    withWidth(600,()=>{panel.contextChanged();expect(help.textContent).toContain('close this panel');});
    withWidth(1400,()=>{panel.contextChanged();expect(help.textContent).toContain('press Add to chat');expect(help.textContent).not.toContain('close this panel');});
  });
});

describe('header and composer',()=> {
  it('starts as one line with a plus button on the left that attaches a reference',()=> {
    const {panel}=setup(),plus=panel.node('.ai-input > [data-ai=attach]'),pick=vi.spyOn(panel.referenceFiles.input,'click').mockImplementation(()=>{});
    expect(panel.node('#ai-prompt').rows).toBe(1);
    expect(plus.getAttribute('aria-label')).toBe('Attach reference');
    expect(plus.compareDocumentPosition(panel.node('#ai-prompt'))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    plus.click();expect(pick).toHaveBeenCalledTimes(1);
  });
  it('grows with its text and shrinks again when the message is sent',()=> {
    const {panel}=setup(),prompt=panel.node('#ai-prompt');let height=70;
    Object.defineProperty(prompt,'scrollHeight',{configurable:true,get:()=>height});
    panel.share();expect(prompt.style.height).toBe('70px');
    height=24;prompt.value='';panel.share();expect(prompt.style.height).toBe('24px');
  });
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
