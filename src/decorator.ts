import * as vscode from 'vscode';
import { parseMarkdown, RangeKind, StyledRange } from './parser';
import { splitRanges } from './range-splitter';

// font-size is injected via the textDecoration CSS property — the value is
// placed verbatim into a CSS declaration block, so appending '; font-size: X'
// is a known trick for scaling text in VS Code editor decorations.
function buildDecorationOptions(scales: number[]): Record<RangeKind, vscode.DecorationRenderOptions> {
  const [s1, s2, s3, s4, s5, s6] = scales;
  return {
    bold: { fontWeight: 'bold' },
    italic: { fontStyle: 'italic' },
    strike: { textDecoration: 'line-through' },
    syntax: { opacity: '0.4' },
    code: { backgroundColor: new vscode.ThemeColor('textCodeBlock.background') },
    heading1: { fontWeight: 'bold', textDecoration: `none; font-size: ${s1}em; line-height: 1.2;` },
    heading2: { fontWeight: 'bold', textDecoration: `none; font-size: ${s2}em; line-height: 1.25;` },
    heading3: { fontWeight: 'bold', textDecoration: `none; font-size: ${s3}em;` },
    heading4: { fontWeight: 'bold', textDecoration: `none; font-size: ${s4}em;` },
    heading5: { fontWeight: 'bold', textDecoration: `none; font-size: ${s5}em;` },
    heading6: { fontWeight: 'bold', textDecoration: `none; font-size: ${s6}em;`, opacity: '0.7' },
  };
}

function createTypes(scales: number[]): Record<RangeKind, vscode.TextEditorDecorationType> {
  const opts = buildDecorationOptions(scales);
  return (Object.keys(opts) as RangeKind[]).reduce((acc, k) => {
    acc[k] = vscode.window.createTextEditorDecorationType(opts[k]);
    return acc;
  }, {} as Record<RangeKind, vscode.TextEditorDecorationType>);
}

const DEFAULT_SCALES = [2, 1.5, 1.3, 1.15, 1, 1];

export class MarkdownDecorator {
  private types: Record<RangeKind, vscode.TextEditorDecorationType>;
  private hiddenSyntaxType: vscode.TextEditorDecorationType;
  private readonly cache: Map<string, StyledRange[]> = new Map();

  // Cached config values — refreshed via refreshConfig() on configuration change.
  private enabled: boolean = true;
  private syntaxMarkersMode: string = 'hidden';
  private maxDocumentLines: number = 5000;
  private headingScales: number[] = DEFAULT_SCALES.slice();

  constructor() {
    this.types = createTypes(this.headingScales);
    this.hiddenSyntaxType = vscode.window.createTextEditorDecorationType({ opacity: '0' });
    this.refreshConfig();
  }

  refreshConfig(): void {
    const cfg = vscode.workspace.getConfiguration('livemarks');
    this.enabled = cfg.get<boolean>('enabled', true);
    this.syntaxMarkersMode = cfg.get<string>('syntaxMarkers', 'hidden');
    this.maxDocumentLines = cfg.get<number>('maxDocumentLines', 5000);

    const newScales = cfg.get<number[]>('headingScales', DEFAULT_SCALES.slice());
    if (newScales.length === 6 && newScales.join() !== this.headingScales.join()) {
      this.headingScales = newScales;
      this.rebuildTypes();
    }
  }

  private rebuildTypes(): void {
    for (const t of Object.values(this.types)) t.dispose();
    this.types = createTypes(this.headingScales);
  }

  // Full apply: re-parses the document and caches the result.
  apply(editor: vscode.TextEditor, cursorLines: Set<number>): void {
    if (!this.enabled || editor.document.languageId !== 'markdown') {
      this.clear(editor);
      return;
    }
    if (editor.document.lineCount > this.maxDocumentLines) {
      this.clear(editor);
      return;
    }
    const source = editor.document.getText();
    const ranges = parseMarkdown(source);
    this.cache.set(editor.document.uri.toString(), ranges);
    this.applyRanges(editor, ranges, cursorLines);
  }

  // Fast path: uses cached parse result, only re-splits syntax ranges by cursor.
  reposition(editor: vscode.TextEditor, cursorLines: Set<number>): void {
    if (!this.enabled || editor.document.languageId !== 'markdown') return;
    const ranges = this.cache.get(editor.document.uri.toString());
    if (!ranges) { this.apply(editor, cursorLines); return; }
    this.applyRanges(editor, ranges, cursorLines);
  }

  private applyRanges(
    editor: vscode.TextEditor,
    styledRanges: StyledRange[],
    cursorLines: Set<number>,
  ): void {
    const { byKind, hiddenSyntax } = splitRanges(styledRanges, cursorLines, this.syntaxMarkersMode);

    for (const kind of Object.keys(this.types) as RangeKind[]) {
      editor.setDecorations(this.types[kind], byKind[kind].map(
        r => new vscode.Range(r.startLine, r.startChar, r.endLine, r.endChar)
      ));
    }
    editor.setDecorations(this.hiddenSyntaxType, hiddenSyntax.map(
      r => new vscode.Range(r.startLine, r.startChar, r.endLine, r.endChar)
    ));
  }

  clear(editor: vscode.TextEditor): void {
    for (const kind of Object.keys(this.types) as RangeKind[]) {
      editor.setDecorations(this.types[kind], []);
    }
    editor.setDecorations(this.hiddenSyntaxType, []);
    this.cache.delete(editor.document.uri.toString());
  }

  evict(uri: vscode.Uri): void {
    this.cache.delete(uri.toString());
  }

  dispose(): void {
    for (const t of Object.values(this.types)) {
      t.dispose();
    }
    this.hiddenSyntaxType.dispose();
  }
}
