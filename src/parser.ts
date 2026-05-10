import MarkdownIt from 'markdown-it';

export type RangeKind =
  | 'bold' | 'italic' | 'strike' | 'syntax' | 'code' | 'listMarker'
  | 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'heading5' | 'heading6';

export interface StyledRange {
  kind: RangeKind;
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

// markdown-it inline token types that carry emphasis markup in v1
const OPEN_KINDS: Record<string, RangeKind> = {
  strong_open: 'bold',
  em_open: 'italic',
  s_open: 'strike',
};

const CLOSE_KINDS: Record<string, boolean> = {
  strong_close: true,
  em_close: true,
  s_close: true,
};

export function parseMarkdown(source: string): StyledRange[] {
  const ranges: StyledRange[] = [];
  const blockTokens = md.parse(source, {});
  const lines = source.split('\n');

  let headingLevel: number | null = null;
  let headingMarkupLen = 0;
  let tableRowLine: number | null = null;
  const tableLineSearchStarts = new Map<number, number>();

  for (const block of blockTokens) {
    if (block.type === 'list_item_open' && block.map && isBulletMarkup(block.markup)) {
      const line = block.map[0];
      const markerStart = findBulletMarkerStart(lines[line] ?? '', block.markup);
      if (markerStart !== -1) {
        const markerEnd = findListMarkerEnd(lines[line] ?? '', markerStart + block.markup.length);
        ranges.push({
          kind: 'listMarker',
          startLine: line,
          startChar: markerStart,
          endLine: line,
          endChar: markerEnd,
        });
      }

    } else if (block.type === 'heading_open' && block.map) {
      const level = parseInt(block.tag[1], 10); // 'h2' → 2
      if (level < 1 || level > 6 || !Number.isFinite(level)) continue;
      headingLevel = level;
      headingMarkupLen = block.markup.length;
      const line = block.map[0];
      ranges.push({ kind: 'syntax', startLine: line, startChar: 0, endLine: line, endChar: headingMarkupLen });

    } else if (block.type === 'heading_close') {
      headingLevel = null;
      headingMarkupLen = 0;

    } else if (block.type === 'tr_open' && block.map) {
      tableRowLine = block.map[0];
      tableLineSearchStarts.set(tableRowLine, 0);

    } else if (block.type === 'tr_close') {
      tableRowLine = null;

    } else if (block.type === 'inline' && block.children) {
      const line = block.map?.[0] ?? tableRowLine;
      if (line === null) continue;

      if (headingLevel !== null) {
        // Locate the actual content span in the source line rather than using
        // block.content.length, which can diverge for ATX-closed headings,
        // escaped characters, or non-standard whitespace after the # markers.
        const srcLine = lines[line] ?? '';
        let contentStart = headingMarkupLen;
        // skip whitespace between markers and content
        while (contentStart < srcLine.length && (srcLine[contentStart] === ' ' || srcLine[contentStart] === '\t')) {
          contentStart++;
        }
        // end before any trailing closing # sequence and whitespace (ATX-closed)
        let contentEnd = srcLine.length;
        const trailingMatch = srcLine.match(/\s+#+\s*$/);
        if (trailingMatch) {
          contentEnd = srcLine.length - trailingMatch[0].length;
        }
        // strip trailing whitespace
        while (contentEnd > contentStart && (srcLine[contentEnd - 1] === ' ' || srcLine[contentEnd - 1] === '\t')) {
          contentEnd--;
        }
        if (contentEnd > contentStart) {
          walkHeadingInline(
            block.children,
            line,
            lines,
            block.content,
            contentStart,
            contentEnd,
            `heading${headingLevel}` as RangeKind,
            ranges,
          );
        }
      } else {
        const searchStart = block.map ? 0 : tableLineSearchStarts.get(line) ?? 0;
        const contentStart = block.map ? undefined : findInlineContentStart(lines[line] ?? '', block.content, searchStart);
        if (!block.map && contentStart === -1) continue;
        if (!block.map && contentStart !== undefined) {
          tableLineSearchStarts.set(line, contentStart + block.content.length);
        }
        walkInline(block.children, line, lines, block.content, ranges, contentStart);
      }
    }
  }

  return ranges;
}

function isBulletMarkup(markup: string): boolean {
  return markup === '*' || markup === '-' || markup === '+';
}

function findBulletMarkerStart(srcLine: string, markup: string): number {
  const markerStart = srcLine.search(/\S/);
  if (markerStart === -1) return -1;
  if (srcLine.startsWith(markup, markerStart)) return markerStart;
  return -1;
}

function findListMarkerEnd(srcLine: string, start: number): number {
  let end = start;
  while (end < srcLine.length && (srcLine[end] === ' ' || srcLine[end] === '\t')) {
    end++;
  }
  return end;
}

function findInlineContentStart(srcLine: string, content: string, searchStart: number): number {
  if (content.length === 0) return searchStart;
  return srcLine.indexOf(content, searchStart);
}

function walkHeadingInline(
  children: MarkdownIt.Token[],
  line: number,
  lines: string[],
  sourceContent: string,
  contentStart: number,
  contentEnd: number,
  headingKind: RangeKind,
  out: StyledRange[],
): void {
  let curChar = contentStart;
  let headingStart = contentStart;

  for (const child of children) {
    const markerKind = OPEN_KINDS[child.type] ?? (CLOSE_KINDS[child.type] ? 'syntax' : undefined);

    if (markerKind !== undefined) {
      pushSameLineRange(out, headingKind, line, headingStart, curChar);
      const markerLen = child.markup.length;
      out.push({ kind: 'syntax', startLine: line, startChar: curChar, endLine: line, endChar: curChar + markerLen });
      curChar += markerLen;
      headingStart = curChar;

    } else if (child.type === 'code_inline') {
      const markerLen = child.markup.length;
      const closeAt = findCodeClose(lines[line] ?? '', curChar + markerLen, child.markup);
      const contentLen = closeAt === -1 ? child.content.length : closeAt - (curChar + markerLen);

      pushSameLineRange(out, headingKind, line, headingStart, curChar);
      out.push({ kind: 'syntax', startLine: line, startChar: curChar, endLine: line, endChar: curChar + markerLen });
      out.push({ kind: 'code', startLine: line, startChar: curChar + markerLen, endLine: line, endChar: curChar + markerLen + contentLen });
      out.push({
        kind: 'syntax',
        startLine: line,
        startChar: curChar + markerLen + contentLen,
        endLine: line,
        endChar: curChar + 2 * markerLen + contentLen,
      });
      curChar += 2 * markerLen + contentLen;
      headingStart = curChar;

    } else {
      curChar += child.content.length;
    }
  }

  // If markdown-it normalized the inline stream differently from the source
  // span, fall back to the source-calculated end so trailing text stays styled.
  pushSameLineRange(out, headingKind, line, headingStart, Math.max(curChar, contentEnd));
}

function pushSameLineRange(
  out: StyledRange[],
  kind: RangeKind,
  line: number,
  startChar: number,
  endChar: number,
): void {
  if (startChar >= endChar) return;
  out.push({ kind, startLine: line, startChar, endLine: line, endChar });
}

interface OpenMarker {
  kind: RangeKind;
  markupLen: number;
  // position after the opening markers
  line: number;
  char: number;
}

// Find the position of the closing backtick sequence in srcLine, starting from
// `start`, verifying it is an exact backtick string (not part of a longer run).
function findCodeClose(srcLine: string, start: number, markup: string): number {
  const mlen = markup.length;
  let pos = start;
  while (pos <= srcLine.length - mlen) {
    const found = srcLine.indexOf(markup, pos);
    if (found === -1) return -1;
    const before = found > 0 ? srcLine[found - 1] : '';
    const after = found + mlen < srcLine.length ? srcLine[found + mlen] : '';
    if (before !== '`' && after !== '`') return found;
    pos = found + 1;
  }
  return -1;
}

function walkInline(
  children: MarkdownIt.Token[],
  startLine: number,
  lines: string[],
  sourceContent: string,
  out: StyledRange[],
  sourceStart?: number,
): void {
  const lineStarts = findInlineLineStarts(lines, startLine, sourceContent, sourceStart);
  // We track a (line, char) cursor advancing through the block source.
  let curLine = startLine;
  let curChar = lineStarts.get(curLine) ?? 0;

  const stack: OpenMarker[] = [];

  for (const child of children) {
    const openKind = OPEN_KINDS[child.type];

    if (openKind !== undefined) {
      const mlen = child.markup.length;
      // Emit syntax decoration for the opening marker
      out.push({
        kind: 'syntax',
        startLine: curLine, startChar: curChar,
        endLine: curLine, endChar: curChar + mlen,
      });
      stack.push({
        kind: openKind,
        markupLen: mlen,
        line: curLine,
        char: curChar + mlen,
      });
      curChar += mlen;

    } else if (CLOSE_KINDS[child.type]) {
      const open = stack.pop();
      if (!open) { curChar += child.markup.length; continue; }

      const mlen = child.markup.length;

      // Emit the content decoration from after the open marker to before the close marker
      if (open.line === curLine) {
        if (open.char < curChar) {
          out.push({
            kind: open.kind,
            startLine: open.line, startChar: open.char,
            endLine: curLine, endChar: curChar,
          });
        }
      } else {
        out.push({
          kind: open.kind,
          startLine: open.line, startChar: open.char,
          endLine: curLine, endChar: curChar,
        });
      }

      // Emit syntax decoration for the closing marker
      out.push({
        kind: 'syntax',
        startLine: curLine, startChar: curChar,
        endLine: curLine, endChar: curChar + mlen,
      });
      curChar += mlen;

    } else if (child.type === 'code_inline') {
      const mlen = child.markup.length;
      const srcLine = lines[curLine] ?? '';
      const closeAt = findCodeClose(srcLine, curChar + mlen, child.markup);
      // Fall back to content.length if the closing sequence isn't on this line
      // (multi-line code spans are extremely rare).
      const contentLen = closeAt === -1 ? child.content.length : closeAt - (curChar + mlen);
      out.push({ kind: 'syntax', startLine: curLine, startChar: curChar, endLine: curLine, endChar: curChar + mlen });
      out.push({ kind: 'code', startLine: curLine, startChar: curChar + mlen, endLine: curLine, endChar: curChar + mlen + contentLen });
      out.push({ kind: 'syntax', startLine: curLine, startChar: curChar + mlen + contentLen, endLine: curLine, endChar: curChar + 2 * mlen + contentLen });
      curChar += 2 * mlen + contentLen;

    } else if (child.type === 'softbreak' || child.type === 'hardbreak') {
      curLine += 1;
      curChar = lineStarts.get(curLine) ?? 0;

    } else {
      // text, html_inline, etc. — advance by content length
      const content = child.content;
      if (!content) continue;

      // Content may itself contain newlines (rare, but handle it)
      const nlIdx = content.lastIndexOf('\n');
      if (nlIdx === -1) {
        curChar += content.length;
      } else {
        const extraLines = content.split('\n').length - 1;
        curLine += extraLines;
        curChar = content.length - nlIdx - 1;
      }
    }
  }
}

function findInlineLineStarts(
  lines: string[],
  startLine: number,
  sourceContent: string,
  sourceStart?: number,
): Map<number, number> {
  const starts = new Map<number, number>();
  const contentLines = sourceContent.split('\n');

  for (let i = 0; i < contentLines.length; i++) {
    const lineNo = startLine + i;
    const srcLine = lines[lineNo] ?? '';
    const contentLine = contentLines[i] ?? '';

    if (contentLine.length === 0) {
      starts.set(lineNo, 0);
      continue;
    }

    const found = srcLine.indexOf(contentLine, i === 0 ? sourceStart : undefined);
    starts.set(lineNo, found === -1 ? 0 : found);
  }

  return starts;
}
