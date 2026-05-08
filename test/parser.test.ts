import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../src/parser';
import type { StyledRange } from '../src/parser';

function pick(ranges: StyledRange[], kind: StyledRange['kind']) {
  return ranges.filter(r => r.kind === kind);
}

describe('parseMarkdown', () => {
  describe('bold', () => {
    it('emits a bold range over the inner text', () => {
      const ranges = pick(parseMarkdown('**bold**'), 'bold');
      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toMatchObject({ startLine: 0, startChar: 2, endLine: 0, endChar: 6 });
    });

    it('emits two syntax ranges for the ** markers', () => {
      const syntax = pick(parseMarkdown('**bold**'), 'syntax');
      expect(syntax).toHaveLength(2);
      expect(syntax[0]).toMatchObject({ startChar: 0, endChar: 2 });
      expect(syntax[1]).toMatchObject({ startChar: 6, endChar: 8 });
    });
  });

  describe('italic', () => {
    it('handles *italic*', () => {
      const ranges = pick(parseMarkdown('*italic*'), 'italic');
      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toMatchObject({ startChar: 1, endChar: 7 });
    });

    it('handles _italic_', () => {
      const ranges = pick(parseMarkdown('_italic_'), 'italic');
      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toMatchObject({ startChar: 1, endChar: 7 });
    });
  });

  describe('strikethrough', () => {
    it('handles ~~strike~~', () => {
      const ranges = pick(parseMarkdown('~~strike~~'), 'strike');
      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toMatchObject({ startChar: 2, endChar: 8 });
    });

    it('emits two syntax ranges for ~~ markers', () => {
      const syntax = pick(parseMarkdown('~~strike~~'), 'syntax');
      expect(syntax).toHaveLength(2);
      expect(syntax[0]).toMatchObject({ startChar: 0, endChar: 2 });
      expect(syntax[1]).toMatchObject({ startChar: 8, endChar: 10 });
    });
  });

  describe('nesting', () => {
    it('bold wrapping italic produces both kinds', () => {
      // **bold _and italic_**
      const source = '**bold _and italic_**';
      const boldRanges = pick(parseMarkdown(source), 'bold');
      const italicRanges = pick(parseMarkdown(source), 'italic');
      expect(boldRanges).toHaveLength(1);
      expect(italicRanges).toHaveLength(1);
      // italic start should be after bold start
      expect(italicRanges[0].startChar).toBeGreaterThan(boldRanges[0].startChar);
      expect(italicRanges[0].endChar).toBeLessThan(boldRanges[0].endChar);
    });
  });

  describe('multi-line', () => {
    it('locates bold on line 2 (index 2)', () => {
      const source = 'line one\nline two\n**bold here**';
      const ranges = pick(parseMarkdown(source), 'bold');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].startLine).toBe(2);
    });
  });

  describe('code span exclusion', () => {
    it('does not style ** inside a code span', () => {
      // markdown-it treats `**not bold**` as code, so no bold/italic ranges expected
      const source = '`**not bold**`';
      expect(pick(parseMarkdown(source), 'bold')).toHaveLength(0);
      expect(pick(parseMarkdown(source), 'syntax')).toHaveLength(0);
    });
  });

  describe('headings', () => {
    it('h1 emits a heading1 range for the content', () => {
      const ranges = pick(parseMarkdown('# Hello'), 'heading1');
      expect(ranges).toHaveLength(1);
      // content starts after '# ' (char 2)
      expect(ranges[0]).toMatchObject({ startLine: 0, startChar: 2, endLine: 0, endChar: 7 });
    });

    it('h2 emits a heading2 range', () => {
      const ranges = pick(parseMarkdown('## World'), 'heading2');
      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toMatchObject({ startChar: 3, endChar: 8 });
    });

    it('h3 through h6 emit the correct kind', () => {
      for (let n = 3; n <= 6; n++) {
        const markers = '#'.repeat(n);
        const ranges = pick(parseMarkdown(`${markers} Text`), `heading${n}` as StyledRange['kind']);
        expect(ranges).toHaveLength(1);
        expect(ranges[0].startChar).toBe(n + 1); // markers + space
      }
    });

    it('emits a syntax range for the # markers', () => {
      const syntax = pick(parseMarkdown('## Heading'), 'syntax');
      expect(syntax).toHaveLength(1);
      expect(syntax[0]).toMatchObject({ startChar: 0, endChar: 2 });
    });

    it('heading on line 1 (index 1) has correct startLine', () => {
      const ranges = pick(parseMarkdown('intro\n# Title'), 'heading1');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].startLine).toBe(1);
    });

    it('paragraph bold still works after a heading', () => {
      const ranges = pick(parseMarkdown('# Title\n\n**bold**'), 'bold');
      expect(ranges).toHaveLength(1);
    });
  });

  describe('no false positives', () => {
    it('plain text produces no styled ranges', () => {
      expect(parseMarkdown('just plain text')).toHaveLength(0);
    });

    it('empty string produces no ranges', () => {
      expect(parseMarkdown('')).toHaveLength(0);
    });
  });
});
