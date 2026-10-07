import { icon } from './icons.js';
// Starting actions shown in the empty conversation: each fills the message box, nothing is sent.
const STARTERS = [
  ['type','Improve typography','Improve the typography of this form: font sizes, hierarchy and readability.'],
  ['spacing','Tighten spacing','Reduce cell padding to 5 px.'],
  ['align','Improve alignment','Improve alignment: left-align text and right-align numbers.'],
  ['drop','Add red accents','Use red accents #a82938.']
];
const node = (tag,className,text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; };
// The empty state: what to ask, how to start, and the Ask AI -> Preview -> Apply flow.
export function renderWelcome() {
  const intro = node('section','ai-welcome'), hero = node('div','ai-hero'), chips = node('div','ai-chips'), attach = node('button','ai-attach'), flow = node('ol','ai-flow');
  hero.setAttribute('aria-hidden','true'); hero.insertAdjacentHTML('beforeend',icon('form') + icon('sparkles'));
  for (const [name,label,prompt] of STARTERS) {
    const chip = node('button',''); chip.type = 'button'; chip.dataset.ai = 'prompt'; chip.dataset.prompt = prompt;
    chip.insertAdjacentHTML('beforeend',icon(name)); chip.append(node('span','',label)); chips.append(chip);
  }
  attach.type = 'button'; attach.dataset.ai = 'attach'; attach.insertAdjacentHTML('beforeend',icon('clip')); attach.append(node('strong','','Attach reference'),node('small','','PDF, PNG or JPG'));
  for (const step of ['Ask AI','Preview','Apply']) flow.append(node('li','',step));
  intro.append(hero,node('h3','','What would you like to improve?'),node('p','','Describe a change or attach a reference. AI will preview changes before you apply them.'),chips,attach,flow);
  return intro;
}
