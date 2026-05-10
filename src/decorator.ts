import * as vscode from 'vscode';
import { parseMarkdown, RangeKind, StyledRange } from './parser';
import { splitRanges } from './range-splitter';

function buildDecorationOptions(): Record<RangeKind, vscode.DecorationRenderOptions> {
  return {
    bold: { fontWeight: 'bold' },
    italic: { fontStyle: 'italic' },
    strike: { textDecoration: 'line-through' },
    syntax: { opacity: '0.4' },
    code: { backgroundColor: new vscode.ThemeColor('textCodeBlock.background') },
    codeBlock: { backgroundColor: new vscode.ThemeColor('textCodeBlock.background') },
    link: {
      color: new vscode.ThemeColor('textLink.foreground'),
      textDecoration: 'underline',
    },
    listMarker: {
      color: 'transparent',
      textDecoration: 'none; font-size: 0;',
      before: {
        color: new vscode.ThemeColor('editor.foreground'),
        fontWeight: 'bold',
      },
    },
    quoteMarker: {
      color: 'transparent',
      textDecoration: 'none; font-size: 0;',
      before: {
        color: new vscode.ThemeColor('textBlockQuote.border'),
        fontWeight: 'bold',
      },
    },
    heading1: { fontWeight: 'bold', color: new vscode.ThemeColor('charts.blue') },
    heading2: { fontWeight: 'bold', color: new vscode.ThemeColor('charts.purple') },
    heading3: { fontWeight: 'bold', color: new vscode.ThemeColor('charts.green') },
    heading4: { fontWeight: 'bold', color: new vscode.ThemeColor('charts.orange') },
    heading5: { fontWeight: 'bold', color: new vscode.ThemeColor('charts.red') },
    heading6: { fontWeight: 'bold', color: new vscode.ThemeColor('charts.yellow'), opacity: '0.85' },
  };
}

function createTypes(): Record<RangeKind, vscode.TextEditorDecorationType> {
  const opts = buildDecorationOptions();
  return (Object.keys(opts) as RangeKind[]).reduce((acc, k) => {
    acc[k] = vscode.window.createTextEditorDecorationType(opts[k]);
    return acc;
  }, {} as Record<RangeKind, vscode.TextEditorDecorationType>);
}

export class MarkdownDecorator {
  private types: Record<RangeKind, vscode.TextEditorDecorationType>;
  private hiddenSyntaxType: vscode.TextEditorDecorationType;
  private readonly cache: Map<string, StyledRange[]> = new Map();

  // Cached config values — refreshed via refreshConfig() on configuration change.
  private enabled: boolean = true;
  private syntaxMarkersMode: string = 'hidden';
  private maxDocumentLines: number = 5000;

  constructor() {
    this.types = createTypes();
    this.hiddenSyntaxType = vscode.window.createTextEditorDecorationType({ opacity: '0' });
    this.refreshConfig();
  }

  refreshConfig(): void {
    const cfg = vscode.workspace.getConfiguration('livemarks');
    this.enabled = cfg.get<boolean>('enabled', true);
    this.syntaxMarkersMode = cfg.get<string>('syntaxMarkers', 'hidden');
    this.maxDocumentLines = cfg.get<number>('maxDocumentLines', 5000);
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
      editor.setDecorations(this.types[kind], byKind[kind].map(r => {
        const range = new vscode.Range(r.startLine, r.startChar, r.endLine, r.endChar);
        if (r.replacementText === undefined) return { range };
        return {
          range,
          renderOptions: {
            before: { contentText: r.replacementText },
          },
        };
      }));
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
