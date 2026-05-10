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

  describe('block prefixes', () => {
    it('emits a list marker range for bullet items', () => {
      const markers = pick(parseMarkdown('* item'), 'listMarker');
      expect(markers).toHaveLength(1);
      expect(markers[0]).toMatchObject({ startLine: 0, startChar: 0, endLine: 0, endChar: 2 });
    });

    it('emits nested list markers at their source indentation', () => {
      const markers = pick(parseMarkdown('* parent\n  - child\n    + grandchild'), 'listMarker');
      expect(markers).toHaveLength(3);
      expect(markers[0]).toMatchObject({ startLine: 0, startChar: 0, endLine: 0, endChar: 2 });
      expect(markers[1]).toMatchObject({ startLine: 1, startChar: 2, endLine: 1, endChar: 4 });
      expect(markers[2]).toMatchObject({ startLine: 2, startChar: 4, endLine: 2, endChar: 6 });
    });

    it('includes all spaces after the bullet marker so the paragraph can be offset', () => {
      const markers = pick(parseMarkdown('*   item'), 'listMarker');
      expect(markers).toHaveLength(1);
      expect(markers[0]).toMatchObject({ startLine: 0, startChar: 0, endLine: 0, endChar: 4 });
    });

    it('emits ordered list markers as faint markup', () => {
      const markers = pick(parseMarkdown('1. item'), 'listMarker');
      expect(markers).toHaveLength(1);
      expect(markers[0]).toMatchObject({ startLine: 0, startChar: 0, endLine: 0, endChar: 3 });
    });

    it('emits ordered list markers with their source number', () => {
      const markers = pick(parseMarkdown('42) item'), 'listMarker');
      expect(markers).toHaveLength(1);
      expect(markers[0]).toMatchObject({ startLine: 0, startChar: 0, endLine: 0, endChar: 4 });
    });

    it('emits quote marker ranges for blockquotes', () => {
      const markers = pick(parseMarkdown('> quote\n> more'), 'quoteMarker');
      expect(markers).toHaveLength(2);
      expect(markers[0]).toMatchObject({ startLine: 0, startChar: 0, endLine: 0, endChar: 2 });
      expect(markers[1]).toMatchObject({ startLine: 1, startChar: 0, endLine: 1, endChar: 2 });
    });

    it('offsets emphasis inside bullet list items', () => {
      const source = '* **/task** is wired to `node scripts/prd.cjs`';
      const ranges = parseMarkdown(source);
      expect(pick(ranges, 'bold')[0]).toMatchObject({ startLine: 0, startChar: 4, endLine: 0, endChar: 9 });
      expect(pick(ranges, 'code')[0]).toMatchObject({ startLine: 0, startChar: 25, endLine: 0, endChar: 45 });
    });

    it('offsets nested list items from their source indentation', () => {
      const source = '* parent\n  * nested **bold** and `code`';
      const ranges = parseMarkdown(source);
      expect(pick(ranges, 'bold')[0]).toMatchObject({ startLine: 1, startChar: 13, endLine: 1, endChar: 17 });
      expect(pick(ranges, 'code')[0]).toMatchObject({ startLine: 1, startChar: 25, endLine: 1, endChar: 29 });
    });

    it('offsets emphasis and code inside blockquotes', () => {
      const source = '> **quote** `code`';
      const ranges = parseMarkdown(source);
      expect(pick(ranges, 'bold')[0]).toMatchObject({ startLine: 0, startChar: 4, endLine: 0, endChar: 9 });
      expect(pick(ranges, 'code')[0]).toMatchObject({ startLine: 0, startChar: 13, endLine: 0, endChar: 17 });
    });
  });

  describe('code span', () => {
    it('emits a code range over the content only (not the backtick markers)', () => {
      const ranges = pick(parseMarkdown('`hello`'), 'code');
      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toMatchObject({ startLine: 0, startChar: 1, endLine: 0, endChar: 6 });
    });

    it('emits two syntax ranges for the backtick markers', () => {
      const syntax = pick(parseMarkdown('`hello`'), 'syntax');
      expect(syntax).toHaveLength(2);
      expect(syntax[0]).toMatchObject({ startChar: 0, endChar: 1 });
      expect(syntax[1]).toMatchObject({ startChar: 6, endChar: 7 });
    });

    it('double-backtick span uses markup length of 2', () => {
      // ``hello``
      const source = '``hello``';
      const code = pick(parseMarkdown(source), 'code');
      expect(code).toHaveLength(1);
      expect(code[0]).toMatchObject({ startChar: 2, endChar: 7 });
    });

    it('does not emit bold/italic ranges inside a code span', () => {
      const source = '`**not bold**`';
      expect(pick(parseMarkdown(source), 'bold')).toHaveLength(0);
    });

    it('backtick markers of a code span appear as syntax ranges', () => {
      // The backticks themselves should be treated as syntax markers (2 of them)
      const source = '`**not bold**`';
      const syntax = pick(parseMarkdown(source), 'syntax');
      expect(syntax).toHaveLength(2);
      expect(syntax[0]).toMatchObject({ startChar: 0, endChar: 1 });
      expect(syntax[1]).toMatchObject({ startChar: 13, endChar: 14 });
    });

    it('code span followed by bold: bold range is correctly positioned', () => {
      // `code` **bold** — verifies cursor advances past the code span correctly
      const source = '`code` **bold**';
      const bold = pick(parseMarkdown(source), 'bold');
      expect(bold).toHaveLength(1);
      expect(bold[0]).toMatchObject({ startChar: 9, endChar: 13 });
    });

    it('padded code span includes surrounding spaces in the code range', () => {
      // CommonMark 6.1: markdown-it strips one leading/trailing space from content,
      // but the source span includes them — the code range must cover the full source content.
      const ranges = pick(parseMarkdown('` hello `'), 'code');
      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toMatchObject({ startChar: 1, endChar: 8 }); // " hello "
    });

    it('padded code span: cursor advances correctly so subsequent ranges are not offset', () => {
      const source = '` hello ` **bold**';
      const bold = pick(parseMarkdown(source), 'bold');
      expect(bold).toHaveLength(1);
      // ` hello ` = 9 chars, space = 1, ** = 2 → bold content starts at 12
      expect(bold[0]).toMatchObject({ startChar: 12, endChar: 16 });
    });
  });

  describe('fenced code blocks', () => {
    it('emits codeBlock ranges for fenced code content and syntax for fences', () => {
      const ranges = parseMarkdown('```ts\nconst x = 1;\n```');
      expect(pick(ranges, 'codeBlock')).toEqual([
        { kind: 'codeBlock', startLine: 1, startChar: 0, endLine: 1, endChar: 12 },
      ]);
      const syntax = pick(ranges, 'syntax');
      expect(syntax).toHaveLength(2);
      expect(syntax[0]).toMatchObject({ startLine: 0, startChar: 0, endLine: 0, endChar: 5 });
      expect(syntax[1]).toMatchObject({ startLine: 2, startChar: 0, endLine: 2, endChar: 3 });
    });
  });

  describe('links', () => {
    it('emits link text and syntax ranges for inline links', () => {
      const ranges = parseMarkdown('[label](https://example.test)');
      expect(pick(ranges, 'link')).toEqual([
        { kind: 'link', startLine: 0, startChar: 1, endLine: 0, endChar: 6 },
      ]);
      const syntax = pick(ranges, 'syntax');
      expect(syntax).toHaveLength(2);
      expect(syntax[0]).toMatchObject({ startChar: 0, endChar: 1 });
      expect(syntax[1]).toMatchObject({ startChar: 6, endChar: 29 });
    });

    it('keeps nested emphasis inside link labels positioned from source text', () => {
      const ranges = parseMarkdown('[label **b**](https://example.test)');
      expect(pick(ranges, 'link')[0]).toMatchObject({ startChar: 1, endChar: 12 });
      expect(pick(ranges, 'bold')[0]).toMatchObject({ startChar: 9, endChar: 10 });
    });
  });

  describe('tables', () => {
    it('decorates inline content inside table header cells', () => {
      const ranges = parseMarkdown('| Col **A** | `B` and *C* |\n|---|---|');
      expect(pick(ranges, 'bold')[0]).toMatchObject({ startLine: 0, startChar: 8, endLine: 0, endChar: 9 });
      expect(pick(ranges, 'code')[0]).toMatchObject({ startLine: 0, startChar: 15, endLine: 0, endChar: 16 });
      expect(pick(ranges, 'italic')[0]).toMatchObject({ startLine: 0, startChar: 23, endLine: 0, endChar: 24 });
    });

    it('decorates inline content inside table body cells', () => {
      const ranges = parseMarkdown('| A | B |\n|---|---|\n| **x** | `y` |');
      expect(pick(ranges, 'bold')[0]).toMatchObject({ startLine: 2, startChar: 4, endLine: 2, endChar: 5 });
      expect(pick(ranges, 'code')[0]).toMatchObject({ startLine: 2, startChar: 11, endLine: 2, endChar: 12 });
    });

    it('locates repeated inline content in later table cells', () => {
      const code = pick(parseMarkdown('| `x` | `x` |\n|---|---|'), 'code');
      expect(code).toHaveLength(2);
      expect(code[0]).toMatchObject({ startLine: 0, startChar: 3, endLine: 0, endChar: 4 });
      expect(code[1]).toMatchObject({ startLine: 0, startChar: 9, endLine: 0, endChar: 10 });
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

    it('extra spaces between # and title still locates content correctly', () => {
      const ranges = pick(parseMarkdown('#  Title'), 'heading1');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].startChar).toBe(3); // skip '#' + two spaces
      expect(ranges[0].endChar).toBe(8);
    });

    it('ATX-closed heading strips the trailing # sequence', () => {
      const ranges = pick(parseMarkdown('# Title #'), 'heading1');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].startChar).toBe(2);
      expect(ranges[0].endChar).toBe(7); // "Title" only
    });

    it('trailing whitespace on heading line does not bloat the range', () => {
      const ranges = pick(parseMarkdown('## Heading   '), 'heading2');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].endChar).toBe(10); // "Heading" ends at 10
    });

    it('inline emphasis markers inside a heading are syntax, not heading text', () => {
      const source = '# **bold** title';
      expect(pick(parseMarkdown(source), 'bold')).toHaveLength(0);
      const heading = pick(parseMarkdown(source), 'heading1');
      expect(heading).toHaveLength(2);
      expect(heading[0]).toMatchObject({ startChar: 4, endChar: 8 });
      expect(heading[1]).toMatchObject({ startChar: 10, endChar: 16 });
      const syntax = pick(parseMarkdown(source), 'syntax');
      expect(syntax).toHaveLength(3);
      expect(syntax[1]).toMatchObject({ startChar: 2, endChar: 4 });
      expect(syntax[2]).toMatchObject({ startChar: 8, endChar: 10 });
    });

    it('backtick markers inside a heading are syntax, not heading text', () => {
      const ranges = parseMarkdown('# Use `code` now');
      const heading = pick(ranges, 'heading1');
      const syntax = pick(ranges, 'syntax');
      const code = pick(ranges, 'code');
      expect(heading).toHaveLength(2);
      expect(heading[0]).toMatchObject({ startChar: 2, endChar: 6 });
      expect(heading[1]).toMatchObject({ startChar: 12, endChar: 16 });
      expect(syntax).toHaveLength(3);
      expect(syntax[1]).toMatchObject({ startChar: 6, endChar: 7 });
      expect(syntax[2]).toMatchObject({ startChar: 11, endChar: 12 });
      expect(code).toHaveLength(1);
      expect(code[0]).toMatchObject({ startChar: 7, endChar: 11 });
    });
  });

  describe('multi-line inline content', () => {
    it('bold spanning two lines has correct start and end lines', () => {
      const source = '**line one\nline two**';
      const ranges = pick(parseMarkdown(source), 'bold');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].startLine).toBe(0);
      expect(ranges[0].endLine).toBe(1);
    });

    it('softbreak tokens advance curLine so bold on line 3 is located correctly', () => {
      const source = 'a\nb\n**x**';
      const bold = pick(parseMarkdown(source), 'bold');
      expect(bold).toHaveLength(1);
      expect(bold[0].startLine).toBe(2);
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
