import type { RangeKind, StyledRange } from './parser';

export interface SimpleRange {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

export interface SplitResult {
  byKind: Record<RangeKind, SimpleRange[]>;
  hiddenSyntax: SimpleRange[];
}

/**
 * Splits StyledRanges into per-kind buckets. Syntax markers always remain in
 * the syntax bucket so markdown markup stays faintly visible.
 */
export function splitRanges(
  styledRanges: StyledRange[],
  cursorLines: Set<number>,
  mode: string,
): SplitResult {
  void cursorLines;
  void mode;

  const byKind: Record<RangeKind, SimpleRange[]> = {
    bold: [], italic: [], strike: [], syntax: [], code: [], codeBlock: [],
    link: [], listMarker: [], quoteMarker: [],
    heading1: [], heading2: [], heading3: [],
    heading4: [], heading5: [], heading6: [],
  };
  const hiddenSyntax: SimpleRange[] = [];

  for (const sr of styledRanges) {
    const r: SimpleRange = {
      startLine: sr.startLine,
      startChar: sr.startChar,
      endLine: sr.endLine,
      endChar: sr.endChar,
    };
    byKind[sr.kind].push(r);
  }

  return { byKind, hiddenSyntax };
}
