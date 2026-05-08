import * as vscode from 'vscode';
import { parseMarkdown, RangeKind } from './parser';

const DECORATION_OPTIONS: Record<RangeKind, vscode.DecorationRenderOptions> = {
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
  strike: { textDecoration: 'line-through' },
  syntax: { opacity: '0.4' },
};

export class MarkdownDecorator {
  private readonly types: Record<RangeKind, vscode.TextEditorDecorationType>;

  constructor() {
    this.types = {
      bold: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.bold),
      italic: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.italic),
      strike: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.strike),
      syntax: vscode.window.createTextEditorDecorationType(DECORATION_OPTIONS.syntax),
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
