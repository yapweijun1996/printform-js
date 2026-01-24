import { describe, it, expect } from 'vitest';
import { splitParagraphIntoHtmlChunks } from '../js/printform/text.js';

describe('Text Segmentation Logic', () => {
  it('should split long text into chunks based on word count', () => {
    const p = document.createElement('p');
    // create "word1 word2 ... word20"
    const text = Array.from({ length: 20 }, (_, i) => `word${i + 1}`).join(' ');
    p.textContent = text;
    
    // limit 10 words per chunk
    const chunks = splitParagraphIntoHtmlChunks(p, 10);
    
    expect(chunks.length).toBe(2);
    // check content of first chunk
    expect(chunks[0]).toContain('word1');
    expect(chunks[0]).toContain('word10');
    expect(chunks[0]).not.toContain('word11');
    
    // check content of second chunk
    expect(chunks[1]).toContain('word11');
    expect(chunks[1]).toContain('word20');
  });

  it('should handle text shorter than limit', () => {
    const p = document.createElement('p');
    p.textContent = "short text";
    const chunks = splitParagraphIntoHtmlChunks(p, 100);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain("short text");
  });

  it('should preserve tag attributes', () => {
    const p = document.createElement('p');
    p.className = "my-class";
    p.setAttribute("data-test", "true");
    p.textContent = "some text";
    
    const chunks = splitParagraphIntoHtmlChunks(p, 10);
    
    expect(chunks[0]).toContain('class="my-class"');
    expect(chunks[0]).toContain('data-test="true"');
  });

  // This test detects the "Inline Markup Fidelity" issue
  it('should preserve inline HTML tags when splitting', () => {
    const p = document.createElement('p');
    // 3 words total
    p.innerHTML = 'Word1 <b>Word2</b> Word3';
    
    // Split with limit 2 to force segmentation
    // This will trigger the logic that uses textContent and strips tags
    const chunks = splitParagraphIntoHtmlChunks(p, 2);
    
    expect(chunks.length).toBe(2);
    // The first chunk should contain Word1 and Word2.
    // Ideally, it should preserve the <b> tag around Word2.
    // If the bug exists, it will be "Word1 Word2" (no tags).
    expect(chunks[0]).toContain('<b>Word2</b>'); 
  });
});
