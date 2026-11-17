// Fixed Gallery UI artwork; labels remain on the owning controls.
const paths = {
  minus: 'M5 12h14', plus: 'M5 12h14M12 5v14',
  down: 'm6 9 6 6 6-6', left: 'm15 6-6 6 6 6', right: 'm9 6 6 6-6 6',
  settings: 'M9.5 3h5l.5 3 2 1 2.8-1 2.5 4-2.3 2v2l2.3 2-2.5 4-2.8-1-2 1-.5 3h-5L9 20l-2-1-2.8 1-2.5-4L4 14v-2L1.7 10l2.5-4L7 7l2-1 .5-3Z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0'
};
export function icon(name) {
  return `<svg class="gallery-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${paths[name]}"/></svg>`;
}
