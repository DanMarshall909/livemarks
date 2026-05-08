# Livemarks

Semi-WYSIWYG markdown styling for VS Code. Bold text appears **bold** in the editor. Italic text appears *italic*. Headings scale to size. The markdown syntax stays visible — just dimmed — so you never lose the source.

It's the middle ground between a plain text editor and a full preview panel.

## What it does

| Syntax | How it renders in the editor |
|---|---|
| `**bold**` | **bold** (markers dimmed) |
| `*italic*` or `_italic_` | *italic* (markers dimmed) |
| `~~strikethrough~~` | ~~strikethrough~~ (markers dimmed) |
| `# Heading 1` | Heading text at 2× size, `#` dimmed |
| `## Heading 2` | 1.5× size |
| `### Heading 3` | 1.3× size |
| `#### H4` · `##### H5` · `###### H6` | 1.15× · 1.0× · 0.9× |

No webview. No mode switching. Works in any VS Code theme, alongside any other extension.

## Installation

Not yet on the marketplace. To run locally:

```
git clone https://github.com/DanMarshall909/livemarks
cd livemarks
npm install
```

Then press **F5** in VS Code to launch an Extension Development Host with Livemarks active. Open any `.md` file.

## How it works

Livemarks uses VS Code's [TextEditorDecorationType](https://code.visualstudio.com/api/references/vscode-api#TextEditorDecorationType) API to apply per-range CSS styling directly in the editor. The document is parsed with [markdown-it](https://github.com/markdown-it/markdown-it) — the same parser VS Code's built-in markdown preview uses — so token boundaries always agree with what the renderer would show.

Decorations are re-applied 150 ms after each edit (debounced), with no perceptible lag on normal documents.

## Roadmap

- [x] Bold, italic, strikethrough
- [x] Headings H1–H6 at scaled font sizes
- [ ] Inline code and fenced code blocks
- [ ] Links
- [ ] Blockquotes
- [ ] Lists

## Development

```bash
npm run compile      # compile TypeScript → out/
npm run test:unit    # run parser unit tests (no VS Code needed)
npm run watch        # watch mode
```

The parser ([src/parser.ts](src/parser.ts)) is pure TypeScript with no VS Code dependency — all logic is unit-tested directly. The VS Code glue lives in [src/decorator.ts](src/decorator.ts) and [src/extension.ts](src/extension.ts).
