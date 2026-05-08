import * as vscode from 'vscode';
import { parseMarkdown, RangeKind } from './parser';

// font-size is injected via the textDecoration CSS property — the value is
// placed verbatim into a CSS declaration block, so appending '; font-size: X'
// is a known trick for scaling text in VS Code editor decorations.
const DECORATION_OPTIONS: Record<RangeKind, vscode.DecorationRenderOptions> = {
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
  strike: { textDecoration: 'line-through' },
  syntax: { opacity: '0.4' },
  heading1: { fontWeight: 'bold', textDecoration: 'none; font-size: 2em; line-height: 1.2;' },
  heading2: { fontWeight: 'bold', textDecoration: 'none; font-size: 1.5em; line-height: 1.25;' },
  heading3: { fontWeight: 'bold', textDecoration: 'none; font-size: 1.3em;' },
  heading4: { fontWeight: 'bold', textDecoration: 'none; font-size: 1.15em;' },
  heading5: { fontWeight: 'bold', textDecoration: 'none; font-size: 1em;' },
  heading6: { fontWeight: 'bold', textDecoration: 'none; font-size: 1em;', opacity: '0.7' },
};

export class MarkdownDecorator {
  private readonly types: Record<RangeKind, vscode.TextEditorDecorationType>;

  constructor() {
    this.types = {
      bold: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.bold),
      italic: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.italic),
      strike: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.strike),
      syntax: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.syntax),
      heading1: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.heading1),
      heading2: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.heading2),
      heading3: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.heading3),
      heading4: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.heading4),
      heading5: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.heading5),
      heading6: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.heading6),
    };
  }

  apply(editor: vscode.TextEditor): void {
    if (editor.document.languageId !== 'markdown') {
      this.clear(editor);
      return;
    }

    const source = editor.document.getText();
    const styledRanges = parseMarkdown(source);

    const byKind: Record<RangeKind, vscode.Range[]> = {
      bold: [], italic: [], strike: [], syntax: [],
      heading1: [], heading2: [], heading3: [],
      heading4: [], heading5: [], heading6: [],
    };

    for (const sr of styledRanges) {
      byKind[sr.kind].push(new vscode.Range(
        sr.startLine, sr.startChar,
        sr.endLine, sr.endChar,
      ));
    }

    for (const kind of Object.keys(this.types) as RangeKind[]) {
      editor.setDecorations(this.types[kind], byKind[kind]);
    }
  }

  clear(editor: vscode.TextEditor): void {
    for (const kind of Object.keys(this.types) as RangeKind[]) {
      editor.setDecorations(this.types[kind], []);
    }
  }

  dispose(): void {
    for (const t of Object.values(this.types)) {
      t.dispose();
    }
  }
}
