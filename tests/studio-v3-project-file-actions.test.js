import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBus, editProject } from '../studio-v3/controller.js';
import { download, exportProject, readProject } from '../studio-v3/file-io.js';
import { newProject } from '../studio-v3/model.js';
import { projectFileAction } from '../studio-v3/project-file-actions.js';

vi.mock('../studio-v3/file-io.js', async importOriginal => ({
  ...await importOriginal(),
  download: vi.fn(),
  exportProject: vi.fn()
}));

beforeEach(() => vi.resetAllMocks());
afterEach(() => { document.body.innerHTML = ''; });

function setup() {
  const bus = createBus(newProject());
  const state = { dirty: true, report: {}, running: false };
  let current = bus;
  const installStatus = vi.fn(), syncControls = vi.fn();
  document.body.innerHTML = '<dialog id="share-dialog" open></dialog>';
  const dialog = document.querySelector('#share-dialog');
  dialog.close = vi.fn();
  return {
    bus, state, dialog, installStatus, syncControls,
    switchProject() { current = createBus(newProject('purchase')); },
    run(name) { return projectFileAction(name, { bus, state, installStatus, syncControls, getBus: () => current }); }
  };
}

it('requests an editable save and keeps its contents reopenable', async () => {
  const fixture = setup();
  const before = structuredClone(fixture.bus.project);
  await expect(fixture.run('save')).resolves.toBe(true);
  expect(download).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.stringMatching(/\.printform\.json$/), 'application/json');
  expect(readProject(download.mock.calls[0][0]).sampleData).toEqual(before.sampleData);
  expect(fixture.bus.project).toEqual(before);
  expect(fixture.state.dirty).toBe(false);
  expect(fixture.syncControls).toHaveBeenCalledOnce();
  expect(fixture.installStatus).toHaveBeenLastCalledWith(expect.stringContaining('Editable form download requested'));
});

it('keeps the draft and shows no success when dispatching an editable save throws', async () => {
  const fixture = setup();
  download.mockImplementationOnce(() => { throw Error('Download unavailable'); });
  await expect(fixture.run('save')).rejects.toThrow('Download unavailable');
  expect(fixture.state.dirty).toBe(true);
  expect(fixture.syncControls).not.toHaveBeenCalled();
  expect(fixture.installStatus).not.toHaveBeenCalled();
});

it('requests share downloads without clearing the source form’s unsaved state', async () => {
  const fixture = setup();
  await expect(fixture.run('save-share')).resolves.toBe(true);
  expect(download).toHaveBeenCalledWith(expect.any(String), 'printform-share.printform.json', 'application/json');
  expect(fixture.installStatus).toHaveBeenLastCalledWith(expect.stringContaining('Share copy download requested'));
  expect(fixture.state.dirty).toBe(true);

  exportProject.mockResolvedValueOnce({ html: '<title>Prepared share</title>' });
  await expect(fixture.run('export-share')).resolves.toBe(true);
  expect(exportProject).toHaveBeenCalledExactlyOnceWith(fixture.bus.project, fixture.state.report, { omitSource: true });
  expect(download).toHaveBeenLastCalledWith('<title>Prepared share</title>', 'printform-share.html', 'text/html');
  expect(fixture.installStatus).toHaveBeenLastCalledWith(expect.stringContaining('Standalone share HTML download requested'));
  expect(fixture.state.dirty).toBe(true);
  expect(fixture.dialog.close).toHaveBeenCalledTimes(2);
});

it.each(['revision', 'document', 'layout', 'validation'])('discards stale prepared exports after a %s change; the current form can retry', async kind => {
  const fixture = setup();
  let finish;
  exportProject.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const exporting = fixture.run('export');
  if (kind === 'revision') await editProject(fixture.bus, [{ type: 'set_manifest_value', path: '/title', value: 'Updated title' }], 'title');
  if (kind === 'document') fixture.switchProject();
  if (kind === 'layout') fixture.state.report = {};
  if (kind === 'validation') fixture.state.running = true;
  finish({ html: '<title>Stale export</title>' });
  await expect(exporting).rejects.toThrow('form changed');
  expect(download).not.toHaveBeenCalled();
  expect(fixture.installStatus).not.toHaveBeenCalled();

  const current = kind === 'document' ? setup() : fixture;
  current.state.running = false;
  exportProject.mockResolvedValueOnce({ html: '<title>Current export</title>' });
  await expect(current.run('export')).resolves.toBe(true);
  expect(download).toHaveBeenCalledExactlyOnceWith('<title>Current export</title>', expect.stringMatching(/\.html$/), 'text/html');
  expect(current.installStatus).toHaveBeenLastCalledWith(expect.stringContaining('Standalone HTML download requested'));
});


it('discards a prepared share HTML when the committed paper changes before dispatch', async () => {
  const fixture = setup();
  let finish;
  exportProject.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const sharing = fixture.run('export-share');
  fixture.state.report = {};
  finish({html:'<title>Stale redacted share</title>'});
  await expect(sharing).rejects.toThrow('form changed');
  expect(download).not.toHaveBeenCalled();
  expect(fixture.dialog.close).not.toHaveBeenCalled();
  expect(fixture.installStatus).not.toHaveBeenCalled();
  expect(fixture.state.dirty).toBe(true);
});
