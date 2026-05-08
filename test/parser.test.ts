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

  describe('no false positives', () => {
    it('plain text produces no styled ranges', () => {
      expect(parseMarkdown('just plain text')).toHaveLength(0);
    });

    it('empty string produces no ranges', () => {
      expect(parseMarkdown('')).toHaveLength(0);
    });
  });
});
