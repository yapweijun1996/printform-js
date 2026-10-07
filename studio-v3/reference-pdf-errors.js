import {referenceError} from './reference-limits.js';

// Compatibility guard for pinned PDF.js 6.3.289: its display layer may resolve
// render before surfacing a failed operator-list stream. This is an owned-worker
// wire contract, not a general public PDF.js API; upgrades must rerun real PDF CI.
// A failure that names a missing function or global (e.g. Map.getOrInsertComputed on an older browser) is the
// browser's gap, not a damaged file. Errors about the file itself (FormatError, InvalidPDFException, bad data
// reads) never match. Accepts a thrown error or a worker's serialized reason.
export function isEngineFailure(reason) {
  if (!reason || typeof reason !== 'object') return false;
  return ['TypeError','ReferenceError','UnknownErrorException'].includes(reason.name)
    && typeof reason.message === 'string' && /\bis not (a function|a constructor|defined)\b/.test(reason.message);
}
export function observePdfWorkerErrors(port) {
  let failure,reject;
  const promise=new Promise((_,fail)=>{reject=fail;});promise.catch(()=>{});
  const fail=code=>{if(!failure){failure=referenceError(code);reject(failure);}};
  const onError=()=>fail('PDF_WORKER');
  const onMessage=({data})=>{
    if(data?.stream!==5 || !data.reason || typeof data.reason!=='object')return;
    fail(typeof data.reason.message==='string' && /Image exceeded maximum allowed size/i.test(data.reason.message)?'PDF_IMAGE_LIMIT':isEngineFailure(data.reason)?'PDF_ENGINE':'FILE_CORRUPT');
  };
  port.addEventListener('message',onMessage);port.addEventListener('error',onError);
  return {promise,check(){if(failure)throw failure;},dispose(){port.removeEventListener('message',onMessage);port.removeEventListener('error',onError);}};
}
