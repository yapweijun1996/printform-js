import {describe,it,expect} from 'vitest';
import { AIPanel } from '../studio-v3/ai-panel.js';

describe('AI-first panel grants',()=> {
  it.each(['What is the current heading font size?','Give the items table header row a light blue background','Improve the font sizes','Tighten the table spacing'])('grants design independent of wording: %s',request=> {
    const root = document.createElement('section');
    root.innerHTML = '<input type="checkbox" id="ai-answer-only">';
    const panel = {root,node:AIPanel.prototype.node};
    const payload = {request,conversation:[]};
    expect(AIPanel.prototype.grantProfile.call(panel,payload)).toBe('design');
    root.querySelector('input').checked = true;
    expect(AIPanel.prototype.grantProfile.call(panel,payload)).toBe('read-only');
  });
});
