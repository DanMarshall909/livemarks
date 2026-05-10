import { describe, it, expect } from 'vitest';
import { splitRanges } from '../src/range-splitter';
import type { SimpleRange } from '../src/range-splitter';
import type { StyledRange } from '../src/parser';

function sr(kind: StyledRange['kind'], startLine: number, startChar: number, endLine: number, endChar: number): StyledRange {
  return { kind, startLine, startChar, endLine, endChar };
}

function plain(startLine: number, startChar: number, endLine: number, endChar: number): SimpleRange {
  return { startLine, startChar, endLine, endChar };
}

describe('splitRanges', () => {
  it('empty input produces empty buckets', () => {
    const { byKind, hiddenSyntax } = splitRanges([], new Set(), 'dimmed');
    expect(hiddenSyntax).toHaveLength(0);
    expect(byKind.bold).toHaveLength(0);
    expect(byKind.syntax).toHaveLength(0);
  });

  describe('dimmed mode', () => {
    it('syntax ranges go into byKind.syntax, never hidden', () => {
      const { byKind, hiddenSyntax } = splitRanges(
        [sr('syntax', 0, 0, 0, 2)],
        new Set([0]),
        'dimmed',
      );
      expect(byKind.syntax).toHaveLength(1);
      expect(hiddenSyntax).toHaveLength(0);
    });

    it('non-syntax ranges land in the correct kind bucket', () => {
      const { byKind } = splitRanges(
        [sr('bold', 1, 2, 1, 5), sr('italic', 2, 0, 2, 3)],
        new Set(),
        'dimmed',
      );
      expect(byKind.bold).toHaveLength(1);
      expect(byKind.italic).toHaveLength(1);
      expect(byKind.bold[0]).toEqual(plain(1, 2, 1, 5));
    });
  });

  describe('hidden mode', () => {
    it('syntax on a non-cursor line goes to hiddenSyntax', () => {
      const { byKind, hiddenSyntax } = splitRanges(
        [sr('syntax', 3, 0, 3, 2)],
        new Set([1]),
        'hidden',
      );
      expect(hiddenSyntax).toHaveLength(1);
      expect(byKind.syntax).toHaveLength(0);
    });

    it('syntax on a cursor line stays visible in byKind.syntax', () => {
      const { byKind, hiddenSyntax } = splitRanges(
        [sr('syntax', 3, 0, 3, 2)],
        new Set([3]),
        'hidden',
      );
      expect(byKind.syntax).toHaveLength(1);
      expect(hiddenSyntax).toHaveLength(0);
    });

    it('mixed lines: cursor-line syntax visible, others hidden', () => {
      const ranges = [
        sr('syntax', 1, 0, 1, 2),
        sr('syntax', 2, 0, 2, 2),
        sr('syntax', 3, 0, 3, 2),
      ];
      const { byKind, hiddenSyntax } = splitRanges(ranges, new Set([2]), 'hidden');
      expect(byKind.syntax).toHaveLength(1);
      expect(byKind.syntax[0]).toEqual(plain(2, 0, 2, 2));
      expect(hiddenSyntax).toHaveLength(2);
    });

    it('non-syntax kinds are never hidden regardless of cursor position', () => {
      const { byKind, hiddenSyntax } = splitRanges(
        [sr('bold', 0, 0, 0, 4)],
        new Set(),
        'hidden',
      );
      expect(byKind.bold).toHaveLength(1);
      expect(hiddenSyntax).toHaveLength(0);
    });
  });

  describe('heading kinds', () => {
    it('heading1 through heading6 each land in the correct bucket', () => {
      for (let n = 1; n <= 6; n++) {
        const kind = `heading${n}` as StyledRange['kind'];
        const { byKind } = splitRanges([sr(kind, 0, 0, 0, 5)], new Set(), 'dimmed');
        expect((byKind as Record<string, SimpleRange[]>)[kind]).toHaveLength(1);
      }
    });
  });

  describe('range coordinates are preserved', () => {
    it('multi-line range coordinates pass through unchanged', () => {
      const { byKind } = splitRanges(
        [sr('italic', 2, 4, 5, 7)],
        new Set(),
        'dimmed',
      );
      expect(byKind.italic[0]).toEqual(plain(2, 4, 5, 7));
    });
  });
});
