import MarkdownIt from 'markdown-it';

export type RangeKind = 'bold' | 'italic' | 'strike' | 'syntax';

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

  for (const block of blockTokens) {
    if (block.type !== 'inline' || !block.children || !block.map) continue;

    const blockStartLine = block.map[0];
    const blockSource = lines
      .slice(blockStartLine, block.map[1])
      .join('\n');

    walkInline(block.children, blockStartLine, blockSource, ranges);
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
  blockSource: string,
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

    } else if (child.type === 'softbreak' || child.type === 'hardbreak') {
      curLine += 1;
      curChar = 0;

    } else {
      // text, code_inline, html_inline, etc. — advance by content length
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
