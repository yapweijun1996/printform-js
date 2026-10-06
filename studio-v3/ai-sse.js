// Incremental server-sent-events parser. push() takes decoded text in any chunking and returns the
// frames that became complete. A frame cut off by the end of the stream is never emitted (per the spec).
// Delimiters are searched in the whole buffer, so a CRLF split between two chunks stays one delimiter.
const FRAME_END = /\r?\n\r?\n/;
export function parseFrame(block) {
  let event = '', data = null;
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':'), field = colon < 0 ? line : line.slice(0,colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data = data === null ? value : `${data}\n${value}`;
  }
  return data === null && !event ? null : {event, data: data ?? ''};
}
export function createSseParser() {
  let buffer = '';
  return {
    push(chunk) {
      buffer += chunk;
      const frames = [];
      for (let match; (match = FRAME_END.exec(buffer));) {
        const frame = parseFrame(buffer.slice(0,match.index));
        buffer = buffer.slice(match.index + match[0].length);
        if (frame) frames.push(frame);
      }
      return frames;
    }
  };
}
