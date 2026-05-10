import * as vscode from 'vscode';
import { MarkdownDecorator } from './decorator';

function cursorLines(editor: vscode.TextEditor): Set<number> {
  return new Set(editor.selections.map(s => s.active.line));
}

export function activate(context: vscode.ExtensionContext): void {
  const decorator = new MarkdownDecorator();
  const output = vscode.window.createOutputChannel('Livemarks');

  // Per-URI debounce timers so concurrent edits to different documents don't
  // drop one another's decoration updates.
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function decorateEditor(editor: vscode.TextEditor): void {
    try {
      decorator.apply(editor, cursorLines(editor));
    } catch (err) {
      output.appendLine(`[error] ${err instanceof Error ? err.message : String(err)}`);
      decorator.clear(editor);
    }
  }

  function scheduleDecorate(editor: vscode.TextEditor): void {
    const key = editor.document.uri.toString();
    const prev = debounceTimers.get(key);
    if (prev) clearTimeout(prev);
    debounceTimers.set(key, setTimeout(() => {
      debounceTimers.delete(key);
      decorateEditor(editor);
    }, 150));
  }

  // Decorate markdown editors already open at activation; skip others.
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.languageId === 'markdown') {
      decorateEditor(editor);
    }
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) decorateEditor(editor);
    }),

    // VS Code propagates decoration types across all editors sharing the same
    // document, so finding one visible editor per document is sufficient.
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
        decorator.refreshConfig();
        for (const editor of vscode.window.visibleTextEditors) {
          // apply() handles the enabled=false case by calling clear().
          decorateEditor(editor);
        }
      }
    }),

    vscode.workspace.onDidCloseTextDocument(document => {
      decorator.evict(document.uri);
    }),

    {
      dispose: () => {
        for (const timer of debounceTimers.values()) clearTimeout(timer);
        debounceTimers.clear();
      }
    },
    { dispose: () => decorator.dispose() },
    { dispose: () => output.dispose() },
  );
}

export function deactivate(): void {}
