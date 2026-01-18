import { describe, it, expect } from 'vitest';

describe('Environment Setup', () => {
  it('should have a working jsdom environment', () => {
    const div = document.createElement('div');
    div.innerHTML = 'Hello Vitest';
    expect(div.innerHTML).toBe('Hello Vitest');
  });

  it('should pass basic math', () => {
    expect(1 + 1).toBe(2);
  });
});
