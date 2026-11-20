const NOTES = Object.freeze({
  invoice:Object.freeze({
    'invoice-reference':'Please include the fictional invoice reference with any questions.',
    'invoice-review':'Please review the fictional invoice details before using this sample.'
  }),
  purchase:Object.freeze({
    'purchase-reference':'Please quote this fictional order reference in related correspondence.',
    'purchase-review':'Please review the fictional order details before using this sample.'
  }),
  delivery:Object.freeze({
    'delivery-reference':'Please quote this fictional delivery reference with any questions.',
    'delivery-review':'Please review the fictional delivery details before using this sample.'
  })
});

export const FICTIONAL_NOTE_PROMPT = 'Choose one note ID appropriate for the supplied fictional print form. Return a single JSON object containing only "noteId", whose value must equal a supplied note ID. Do not write note text, call tools, or supply additional fields.';

function noteChoices(formType) {
  if (typeof formType !== 'string' || !Object.hasOwn(NOTES,formType)) {
    throw Object.assign(new Error('Unsupported fictional form type.'),{code:'DATA_DRAFT_SOURCE_DENIED'});
  }
  return NOTES[formType];
}

export function fictionalNoteRequest(formType) {
  return JSON.stringify({formType,noteIds:Object.keys(noteChoices(formType))});
}

export function readFictionalNoteChoice(formType,text) {
  const choices = noteChoices(formType);
  // The single-key grammar also rejects duplicate keys and explanatory text.
  const match = typeof text === 'string' && text.length <= 120 && /^\s*\{\s*"noteId"\s*:\s*"([a-z-]{1,40})"\s*\}\s*$/u.exec(text);
  if (!match || !Object.hasOwn(choices,match[1])) throw Object.assign(new Error('The AI response did not return an allowed fictional note.'),{code:'FICTIONAL_NOTE_RESPONSE_INVALID'});
  return choices[match[1]];
}
