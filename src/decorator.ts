import * as vscode from 'vscode';
import { parseMarkdown, RangeKind, StyledRange } from './parser';
import { splitRanges } from './range-splitter';

interface StyleConfig {
  syntaxOpacity: string;
  markerOpacity: string;
  codeBackground: string;
  codeBlockBackground: string;
  linkColor: string;
  linkUnderline: boolean;
  headingBold: boolean;
  headingColors: string[];
  headingOpacities: string[];
}

const DEFAULT_STYLE_CONFIG: StyleConfig = {
  syntaxOpacity: '0.4',
  markerOpacity: '0.4',
  codeBackground: 'textCodeBlock.background',
  codeBlockBackground: 'textCodeBlock.background',
  linkColor: 'textLink.foreground',
  linkUnderline: true,
  headingBold: true,
  headingColors: [
    'charts.blue',
    'charts.purple',
    'charts.green',
    'charts.orange',
    'charts.red',
    'charts.yellow',
  ],
  headingOpacities: ['1', '1', '1', '1', '1', '0.85'],
};

function configuredThemeColor(value: string): vscode.ThemeColor | string {
  if (/^(#|rgb\(|rgba\(|hsl\(|hsla\(|var\()/i.test(value)) return value;
  return new vscode.ThemeColor(value);
}

function mergeStyleConfig(value: Partial<StyleConfig> | undefined): StyleConfig {
  const cfg = value ?? {};
  return {
    ...DEFAULT_STYLE_CONFIG,
    ...cfg,
    headingColors: normalizeArray(cfg.headingColors, DEFAULT_STYLE_CONFIG.headingColors),
    headingOpacities: normalizeArray(cfg.headingOpacities, DEFAULT_STYLE_CONFIG.headingOpacities),
  };
}

function normalizeArray(value: string[] | undefined, fallback: string[]): string[] {
  if (!Array.isArray(value) || value.length !== fallback.length) return fallback.slice();
  return value.slice();
}

function headingStyle(style: StyleConfig, index: number): vscode.DecorationRenderOptions {
  return {
    fontWeight: style.headingBold ? 'bold' : undefined,
    color: configuredThemeColor(style.headingColors[index]),
    opacity: style.headingOpacities[index],
  };
}

function buildDecorationOptions(style: StyleConfig): Record<RangeKind, vscode.DecorationRenderOptions> {
  return {
    bold: { fontWeight: 'bold' },
    italic: { fontStyle: 'italic' },
    strike: { textDecoration: 'line-through' },
    syntax: { opacity: style.syntaxOpacity },
    code: { backgroundColor: configuredThemeColor(style.codeBackground) },
    codeBlock: { backgroundColor: configuredThemeColor(style.codeBlockBackground) },
    link: {
      color: configuredThemeColor(style.linkColor),
      textDecoration: style.linkUnderline ? 'underline' : undefined,
    },
    listMarker: { opacity: style.markerOpacity },
    quoteMarker: { opacity: style.markerOpacity },
    heading1: headingStyle(style, 0),
    heading2: headingStyle(style, 1),
    heading3: headingStyle(style, 2),
    heading4: headingStyle(style, 3),
    heading5: headingStyle(style, 4),
    heading6: headingStyle(style, 5),
  };
}

function createTypes(style: StyleConfig): Record<RangeKind, vscode.TextEditorDecorationType> {
  const opts = buildDecorationOptions(style);
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
  private syntaxMarkersMode: string = 'dimmed';
  private maxDocumentLines: number = 5000;
  private styleConfig: StyleConfig = DEFAULT_STYLE_CONFIG;

  constructor() {
    this.types = createTypes(this.styleConfig);
    this.hiddenSyntaxType = vscode.window.createTextEditorDecorationType({ opacity: '0' });
    this.refreshConfig();
  }

  refreshConfig(): void {
    const cfg = vscode.workspace.getConfiguration('livemarks');
    this.enabled = cfg.get<boolean>('enabled', true);
    this.syntaxMarkersMode = cfg.get<string>('syntaxMarkers', 'dimmed');
    this.maxDocumentLines = cfg.get<number>('maxDocumentLines', 5000);

    const newStyleConfig = mergeStyleConfig(cfg.get<Partial<StyleConfig>>('styles'));
    if (JSON.stringify(newStyleConfig) !== JSON.stringify(this.styleConfig)) {
      this.styleConfig = newStyleConfig;
      this.rebuildTypes();
    }
  }

  private rebuildTypes(): void {
    for (const t of Object.values(this.types)) t.dispose();
    this.types = createTypes(this.styleConfig);
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
