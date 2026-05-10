# Livemarks

Semi-WYSIWYG markdown styling for VS Code. Bold text appears **bold** in the editor. Italic text appears *italic*. Headings stand out in color. The markdown syntax stays visible — just dimmed — so you never lose the source.

It's the middle ground between a plain text editor and a full preview panel.

## What it does

| Syntax | How it renders in the editor |
|---|---|
| `**bold**` | **bold** (markers dimmed) |
| `*italic*` or `_italic_` | *italic* (markers dimmed) |
| `~~strikethrough~~` | ~~strikethrough~~ (markers dimmed) |
| `* item`, `- item`, `+ item` | Bullet marker faintly visible |
| `1. item`, `2) item` | Ordered marker faintly visible |
| `> quote` | Quote marker faintly visible |
| `` `code` `` and fenced code | Code background with syntax markers dimmed |
| `[label](url)` | Link label colored and underlined, URL syntax dimmed |
| `# Heading 1` | Colored heading text, `#` dimmed |
| `## Heading 2` | Different heading color, `##` dimmed |
| `### Heading 3` | Different heading color, `###` dimmed |
| `#### H4` · `##### H5` · `###### H6` | Colored heading text, markers dimmed |

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

## Configuration

All rendering settings can be configured in VS Code `settings.json`:

```json
{
  "livemarks.enabled": true,
  "livemarks.maxDocumentLines": 5000,
  "livemarks.styles": {
    "syntaxOpacity": "0.4",
    "markerOpacity": "0.4",
    "codeBackground": "textCodeBlock.background",
    "codeBlockBackground": "textCodeBlock.background",
    "linkColor": "textLink.foreground",
    "linkUnderline": true,
    "headingBold": true,
    "headingColors": [
      "charts.blue",
      "charts.purple",
      "charts.green",
      "charts.orange",
      "charts.red",
      "charts.yellow"
    ],
    "headingOpacities": ["1", "1", "1", "1", "1", "0.85"]
  }
}
```

Color values can be VS Code theme color ids or CSS colors like `#4fc1ff`.

## Roadmap

- [x] Bold, italic, strikethrough
- [x] Headings H1–H6
- [x] Inline code and fenced code blocks
- [x] Links
- [x] Blockquotes
- [x] Bullet list markers
- [x] Ordered lists

## Development

```bash
npm run compile      # compile TypeScript → out/
npm run test:unit    # run parser unit tests (no VS Code needed)
npm run watch        # watch mode
```

The parser ([src/parser.ts](src/parser.ts)) is pure TypeScript with no VS Code dependency — all logic is unit-tested directly. The VS Code glue lives in [src/decorator.ts](src/decorator.ts) and [src/extension.ts](src/extension.ts).
