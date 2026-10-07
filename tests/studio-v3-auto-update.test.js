import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {setupUpdates} from '../studio-v3/update.js';
import {createUpdateWork,RECOVERY_KEY} from '../studio-v3/update-work.js';

const OLD = 'a'.repeat(40), NEXT = 'b'.repeat(40);
const page = () => {
  document.head.innerHTML = `<meta name="printform-source-revision" content="${OLD}">`;
  document.body.innerHTML = `<span id="app-version"></span><button id="update-button" disabled></button><p id="update-status"></p>
    <textarea id="ai-prompt"></textarea><input id="document-name" value="Title">
    <button id="recovery-download" hidden></button><button id="recovery-discard" hidden></button>
    <dialog id="update-dialog"><p data-update-summary></p><button data-update-choice="keep">keep</button><button data-update-choice="discard">discard</button><button data-update-choice="stay">stay</button></dialog>`;
  const dialog = document.querySelector('#update-dialog');
  // jsdom has no modal dialog: record that it was shown and close it with the clicked choice.
  dialog.showModal = vi.fn(() => { dialog.open = true; });
  dialog.close = value => { dialog.returnValue = value; dialog.open = false; dialog.dispatchEvent(new Event('close')); };
  return dialog;
};
// A service worker pair: the active one runs OLD, a verified waiting one carries `build`.
function fakeWorkers(build = NEXT) {
  const events = new EventTarget();
  const make = value => ({state: 'installed', addEventListener() {}, removeEventListener() {}, postMessage(message, ports) {
    if (message.type === 'VERSION') ports[0].postMessage({ready: true, build: value});
    if (message.type === 'ACTIVATE') { this.state = 'activated'; sw.controller = this; }
  }});
  const active = make(OLD), waiting = make(build);
  const registration = {active, waiting, installing: null, addEventListener() {}, removeEventListener() {}, update: async () => {}};
  const sw = {controller: active, register: async () => registration, addEventListener: (...args) => events.addEventListener(...args), removeEventListener() {}};
  return {sw, registration, events};
}
const makeWork = (over = {}) => ({pending: () => false, prepare: vi.fn(async () => true), leaving: () => false, failed: vi.fn(), ...over});
const reloader = () => vi.fn(() => window.dispatchEvent(new Event('pagehide')));

beforeEach(() => { page(); });
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

describe('automatic update', () => {
  it('updates without a click when a verified newer build is ready', async () => {
    const {sw} = fakeWorkers(), work = makeWork(), reload = reloader();
    setupUpdates(work, {sw, reload});
    await vi.waitFor(() => expect(reload).toHaveBeenCalledWith(NEXT));
    expect(work.prepare).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#update-status').textContent).toContain('Updating to');
  });

  it('does nothing when the ready build is the one already running', async () => {
    const {sw} = fakeWorkers(OLD), work = makeWork(), reload = reloader();
    setupUpdates(work, {sw, reload});
    await vi.waitFor(() => expect(document.querySelector('#update-button').disabled).toBe(false));
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(work.prepare).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled();
    expect(document.querySelector('#update-button').textContent).toBe('Check for updates');
  });

  it('asks once per build: after Stay the same build is not offered again automatically', async () => {
    const {sw, events} = fakeWorkers(), work = makeWork({prepare: vi.fn(async () => false)}), reload = reloader();
    setupUpdates(work, {sw, reload});
    await vi.waitFor(() => expect(work.prepare).toHaveBeenCalledTimes(1));
    events.dispatchEvent(new Event('controllerchange')); await new Promise(resolve => setTimeout(resolve, 30));
    expect(work.prepare).toHaveBeenCalledTimes(1); expect(reload).not.toHaveBeenCalled();
    const button = document.querySelector('#update-button');
    expect(button.textContent).toBe(`Update to ${NEXT.slice(0, 12)}`);
    work.prepare.mockResolvedValueOnce(true); button.click();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledWith(NEXT));
  });

  it('falls back to the manual button, with the reason, when the automatic update cannot proceed', async () => {
    const {sw} = fakeWorkers(), work = makeWork({prepare: vi.fn(async () => { throw new Error('A file read, edit or database save is active. Wait, then retry.'); })}), reload = reloader();
    setupUpdates(work, {sw, reload});
    await vi.waitFor(() => expect(work.failed).toHaveBeenCalled());
    const status = document.querySelector('#update-status').textContent;
    expect(status).toContain('could not update automatically'); expect(status).toContain('file read');
    expect(reload).not.toHaveBeenCalled();
    expect(document.querySelector('#update-button').textContent).toBe(`Update to ${NEXT.slice(0, 12)}`);
    expect(document.querySelector('#update-button').disabled).toBe(false);
  });
});

describe('noticing a new build in a tab that stays open', () => {
  const visible = value => { Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>value}); document.dispatchEvent(new Event('visibilitychange')); };
  afterEach(() => { vi.useRealTimers(); delete document.visibilityState; });
  const start = async () => {
    const {sw, registration} = fakeWorkers(OLD); registration.update = vi.fn(async () => {});
    setupUpdates(makeWork(), {sw, reload: reloader()});
    await vi.waitFor(() => expect(document.querySelector('#update-button').disabled).toBe(false));
    return registration;
  };

  it('looks for an update when the tab becomes visible after a while', async () => {
    const registration = await start(); const later = Date.now() + 11 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    visible('visible');
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('does not look again within ten minutes, nor while the tab is hidden', async () => {
    const registration = await start();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 1000);
    visible('visible'); visible('hidden');
    expect(registration.update).not.toHaveBeenCalled();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 20 * 60 * 1000);
    visible('hidden');
    expect(registration.update).not.toHaveBeenCalled();
  });

  it('ignores a failed background check silently', async () => {
    const registration = await start(); registration.update = vi.fn(async () => { throw new Error('offline'); });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);
    expect(() => visible('visible')).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(document.querySelector('#update-status').textContent).not.toContain('offline');
  });
});

describe('update approval', () => {
  const deps = (over = {}) => ({
    getBus: () => ({project: {manifest: {title: 'Title'}}}), state: {dirty: false, dataDraft: null, fileReads: 0},
    database: {draft: null, busy: false, pending: false, store: {persistent: true}}, drafts: {drafts: new Map(), applying: new Set()},
    ai: {busy: false, proposal: null, applying: false, cancel: vi.fn(), snapshot: () => ({})},
    install() {}, renderPanels() {}, syncControls() {}, render: async () => {}, settle: async () => {}, ...over
  });

  it('shows no dialog and proceeds when nothing is unsaved', async () => {
    const dialog = document.querySelector('#update-dialog'), work = createUpdateWork(deps());
    expect(work.pending()).toBe(false);
    expect(await work.prepare()).toBe(true);
    expect(dialog.showModal).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RECOVERY_KEY)).toBeNull();
    work.failed();
  });

  it.each([
    ['a dirty template', {state: {dirty: true, dataDraft: null, fileReads: 0}}],
    ['a data draft', {state: {dirty: false, dataDraft: '{}', fileReads: 0}}],
    ['a running AI request', {ai: {busy: true, proposal: null, applying: false, cancel: vi.fn(), snapshot: () => ({})}}]
  ])('asks for approval when there is %s, and Stay changes nothing', async (name, over) => {
    const dialog = document.querySelector('#update-dialog'), work = createUpdateWork(deps(over));
    expect(work.pending()).toBeTruthy();
    const result = work.prepare();
    await vi.waitFor(() => expect(dialog.showModal).toHaveBeenCalledTimes(1));
    expect(dialog.querySelector('[data-update-summary]').textContent).toContain('unsaved work');
    dialog.querySelector('[data-update-choice=stay]').click();
    expect(await result).toBe(false);
    expect(document.body.inert).toBeFalsy(); expect(sessionStorage.getItem(RECOVERY_KEY)).toBeNull();
  });

  it('asks when the prompt or the document title holds unsaved text', async () => {
    const dialog = document.querySelector('#update-dialog'), work = createUpdateWork(deps());
    document.querySelector('#ai-prompt').value = 'Fictional draft only';
    expect(work.pending()).toBeTruthy();
    const result = work.prepare(); await vi.waitFor(() => expect(dialog.showModal).toHaveBeenCalledTimes(1));
    dialog.querySelector('[data-update-choice=stay]').click(); await result;
    document.querySelector('#ai-prompt').value = ''; document.querySelector('#document-name').value = 'Renamed';
    expect(work.pending()).toBe(true);
  });

  it('never skips the approval for storage it cannot protect: tab-only database blocks the update', async () => {
    const work = createUpdateWork(deps({database: {draft: null, busy: false, pending: false, store: {persistent: false}}}));
    await expect(work.prepare()).rejects.toThrow('tab-only');
  });
});
