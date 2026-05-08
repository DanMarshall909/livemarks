import * as vscode from 'vscode';
import { MarkdownDecorator } from './decorator';

export function activate(context: vscode.ExtensionContext): void {
  const decorator = new MarkdownDecorator();

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function decorateEditor(editor: vscode.TextEditor): void {
    decorator.apply(editor);
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

    { dispose: () => { if (debounceTimer) clearTimeout(debounceTimer); } },
    { dispose: () => decorator.dispose() },
  );
}

export function deactivate(): void {}
