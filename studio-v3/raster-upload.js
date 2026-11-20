import { designOperations, importRasterAsset } from './controller.js';

async function ensureRasterDecodes(source) {
  const image = new Image();
  let timeout;
  try {
    image.src = source;
    const expired = new Promise((_,reject)=> { timeout = setTimeout(()=>reject(new Error('Image decode timed out')),5000); });
    await Promise.race([image.decode(),expired]);
    if (image.naturalWidth && image.naturalHeight) return;
  } catch {
    // Use one user-facing error for failed decodes and keep image bytes out of status text.
  } finally {
    clearTimeout(timeout);
    image.removeAttribute('src');
  }
  throw new Error('The selected image could not be decoded. Choose another PNG, JPEG, GIF or WebP.');
}

export function setupRasterUpload({getBus,state,guard,queueEdit,mutate,status,root=document}) {
  const latest = new Map();
  root.addEventListener('change',async event=> {
    const input = event.target.closest('[data-image-target]');
    if (!input?.files?.length) return;
    const file = input.files[0], target = input.dataset.imageTarget, bus = getBus();
    input.value = '';
    const ticket = {};
    latest.set(target,ticket);
    const isLatest = ()=>latest.get(target) === ticket;
    const isCurrent = ()=>isLatest() && bus === getBus();
    try {
      await guard(async()=> {
        if (!isCurrent()) return;
        ++state.fileReads;
        try {
          await queueEdit(async()=> {
            if (!isCurrent()) return;
            const revision = bus.revision;
            const unchanged = ()=>isCurrent() && bus.revision === revision;
            let operations;
            try {
              const design = await importRasterAsset(bus.project,file,target);
              if (!unchanged()) return;
              operations = designOperations(bus.project,design);
              await ensureRasterDecodes(design.assets.at(-1).src);
            } catch (error) {
              if (unchanged()) status(error.message);
              return;
            }
            if (unchanged()) await mutate(operations,'embedded image');
          },false);
        } finally { --state.fileReads; }
      });
    } catch (error) { if (isCurrent()) status(error.message); }
    finally { if (isLatest()) latest.delete(target); }
  });
}
