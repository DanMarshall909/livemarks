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
 * Splits StyledRanges into per-kind buckets and a hidden-syntax bucket based
 * on cursor position and syntaxMarkers mode. Pure function — no VS Code API.
 */
export function splitRanges(
  styledRanges: StyledRange[],
  cursorLines: Set<number>,
  mode: string,
): SplitResult {
  const byKind: Record<RangeKind, SimpleRange[]> = {
    bold: [], italic: [], strike: [], syntax: [], code: [],
    heading1: [], heading2: [], heading3: [],
    heading4: [], heading5: [], heading6: [],
  };
  const hiddenSyntax: SimpleRange[] = [];

  for (const sr of styledRanges) {
    const r: SimpleRange = { startLine: sr.startLine, startChar: sr.startChar, endLine: sr.endLine, endChar: sr.endChar };
    if (sr.kind === 'syntax' && mode === 'hidden') {
      if (cursorLines.has(sr.startLine)) {
        byKind.syntax.push(r);
      } else {
        hiddenSyntax.push(r);
      }
    } else {
      byKind[sr.kind].push(r);
    }
  }

  return { byKind, hiddenSyntax };
}
