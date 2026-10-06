import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {PreviewLaunch,PREVIEW_TIMING} from '../studio-v3/preview-launch.js';

const {helloMs,launches,renderMs}=PREVIEW_TIMING;
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>vi.useRealTimers());

describe('PreviewLaunch',()=> {
  it('assigns srcdoc once, never through an empty reset that a busy browser can navigate to instead',()=> {
    const writes=[],frame={set srcdoc(value){writes.push(value);}};
    new PreviewLaunch(frame).start('<p>doc</p>',{onFailure:()=>{}});
    expect(writes).toEqual(['<p>doc</p>']);
  });

  it('stays quiet once the document says hello, until the render timeout',()=> {
    const frame={},onFailure=vi.fn(),launch=new PreviewLaunch(frame);
    launch.start('<p>doc</p>',{onFailure});vi.advanceTimersByTime(helloMs-1);launch.hello();
    vi.advanceTimersByTime(renderMs-helloMs);expect(onFailure).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toMatchObject({code:'RENDER_TIMEOUT'});
  });

  it('assigns the document again when no hello arrives, with different text so it always navigates',()=> {
    const writes=[],frame={set srcdoc(value){writes.push(value);}};
    new PreviewLaunch(frame).start('<p>doc</p>',{onFailure:()=>{}});
    vi.advanceTimersByTime(helloMs);
    expect(writes).toHaveLength(2);expect(writes[1]).not.toBe(writes[0]);expect(writes[1].startsWith(writes[0])).toBe(true);
  });

  it('stops retrying after the configured launches and reports that the preview did not start',()=> {
    const writes=[],frame={set srcdoc(value){writes.push(value);}},onFailure=vi.fn();
    new PreviewLaunch(frame).start('<p>doc</p>',{onFailure});
    vi.advanceTimersByTime(helloMs*launches);
    expect(writes).toHaveLength(launches);expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toMatchObject({code:'PREVIEW_NOT_STARTED'});
    expect(onFailure.mock.calls[0][0].message).not.toMatch(/data size/i);
    vi.advanceTimersByTime(renderMs);expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('a late hello after a retry still cancels further retries',()=> {
    const writes=[],frame={set srcdoc(value){writes.push(value);}},onFailure=vi.fn(),launch=new PreviewLaunch(frame);
    launch.start('<p>doc</p>',{onFailure});vi.advanceTimersByTime(helloMs);launch.hello();
    vi.advanceTimersByTime(helloMs*launches);expect(writes).toHaveLength(2);expect(onFailure).not.toHaveBeenCalled();
  });

  it('stop() cancels every timer and a new start() begins afresh',()=> {
    const writes=[],frame={set srcdoc(value){writes.push(value);}},onFailure=vi.fn(),launch=new PreviewLaunch(frame);
    launch.start('<p>one</p>',{onFailure});launch.stop();vi.advanceTimersByTime(renderMs*2);
    expect(writes).toHaveLength(1);expect(onFailure).not.toHaveBeenCalled();
    launch.start('<p>two</p>',{onFailure});vi.advanceTimersByTime(helloMs);
    expect(writes).toHaveLength(3);expect(writes[2].startsWith('<p>two</p>')).toBe(true);
  });

  it('starting a new launch discards the previous one without a stop()',()=> {
    const writes=[],frame={set srcdoc(value){writes.push(value);}},first=vi.fn(),launch=new PreviewLaunch(frame);
    launch.start('<p>one</p>',{onFailure:first});launch.start('<p>two</p>',{onFailure:()=>{}});vi.advanceTimersByTime(renderMs);
    expect(first).not.toHaveBeenCalled();
  });
});
