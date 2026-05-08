import * as vscode from 'vscode';
import { MarkdownDecorator } from './decorator';

function cursorLines(editor: vscode.TextEditor): Set<number> {
  return new Set(editor.selections.map(s => s.active.line));
}

export function activate(context: vscode.ExtensionContext): void {
  const decorator = new MarkdownDecorator();

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function decorateEditor(editor: vscode.TextEditor): void {
    decorator.apply(editor, cursorLines(editor));
  }

  function scheduleDecorate(editor: vscode.TextEditor): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => decorateEditor(editor), 150);
  }

  // Decorate all markdown editors already open at activation
  for (const editor of vscode.window.visibleTextEditors) {
    decorateEditor(editor);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) decorateEditor(editor);
    }),

    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.visibleTextEditors.find(
        e => e.document === event.document
      );
      if (editor) scheduleDecorate(editor);
    }),

    vscode.window.onDidChangeTextEditorSelection(event => {
      decorator.reposition(event.textEditor, cursorLines(event.textEditor));
    }),

    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('livemarks')) {
        for (const editor of vscode.window.visibleTextEditors) {
          decorator.reposition(editor, cursorLines(editor));
        }
      }
    }),

    { dispose: () => { if (debounceTimer) clearTimeout(debounceTimer); } },
    { dispose: () => decorator.dispose() },
  );
}

export function deactivate(): void {}
