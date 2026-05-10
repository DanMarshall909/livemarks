import MarkdownIt from 'markdown-it';

export type RangeKind =
  | 'bold' | 'italic' | 'strike' | 'syntax' | 'code'
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

  for (const block of blockTokens) {
    if (block.type === 'heading_open' && block.map) {
      const level = parseInt(block.tag[1], 10); // 'h2' → 2
      if (level < 1 || level > 6 || !Number.isFinite(level)) continue;
      headingLevel = level;
      headingMarkupLen = block.markup.length;
      const line = block.map[0];
      ranges.push({ kind: 'syntax', startLine: line, startChar: 0, endLine: line, endChar: headingMarkupLen });

    } else if (block.type === 'heading_close') {
      headingLevel = null;
      headingMarkupLen = 0;

    } else if (block.type === 'inline' && block.children && block.map) {
      const line = block.map[0];

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
          ranges.push({
            kind: `heading${headingLevel}` as RangeKind,
            startLine: line, startChar: contentStart,
            endLine: line, endChar: contentEnd,
          });
        }
        // NOTE: inline children inside headings (e.g. **bold** in # Title) are
        // intentionally not walked here — heading ranges cover the whole content span.
      } else {
        walkInline(block.children, line, ranges);
      }
    }
  }

  return ranges;
}

interface OpenMarker {
  kind: RangeKind;
  markupLen: number;
  // position after the opening markers
  line: number;
  char: number;
}

function walkInline(
  children: MarkdownIt.Token[],
  startLine: number,
  out: StyledRange[]
): void {
  // We track a (line, char) cursor advancing through the block source.
  let curLine = startLine;
  let curChar = 0;

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
      const clen = child.content.length;
      // NOTE: markdown-it strips one leading/trailing space per CommonMark 6.1,
      // so clen may be shorter than the actual source span for ` padded ` spans.
      // Ranges computed here will be off by the stripped spaces in that rare case.
      out.push({ kind: 'syntax', startLine: curLine, startChar: curChar, endLine: curLine, endChar: curChar + mlen });
      out.push({ kind: 'code', startLine: curLine, startChar: curChar + mlen, endLine: curLine, endChar: curChar + mlen + clen });
      out.push({ kind: 'syntax', startLine: curLine, startChar: curChar + mlen + clen, endLine: curLine, endChar: curChar + 2 * mlen + clen });
      curChar += 2 * mlen + clen;

    } else if (child.type === 'softbreak' || child.type === 'hardbreak') {
      curLine += 1;
      curChar = 0;

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
