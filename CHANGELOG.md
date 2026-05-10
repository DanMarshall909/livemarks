# Changelog

All notable changes to Livemarks are documented here.

## [Unreleased]

### Added
- `livemarks.enabled` setting — disable decorations per-workspace without uninstalling.
- `livemarks.maxDocumentLines` setting — skip decoration on large files (default 5000 lines) to avoid input lag.
- Livemarks output channel for surfacing parse errors without crashing.
- Per-URI debounce timers so concurrent edits to multiple open documents are handled independently.
- Cache eviction on document close via `onDidCloseTextDocument`.
- `splitRanges` extracted to `range-splitter.ts` — pure, testable, no VS Code API dependency.
- Decorator tests for the range-splitting logic.
- Additional parser tests: ATX-closed headings, extra whitespace, multi-line inline content, known heading inline-child limitation.
- Bullet list marker decoration for `*`, `-`, and `+` items, preserving nested source indentation.
- Theme-aware colorization for heading levels H1–H6.
- Inline styling inside markdown table header and body cells.

### Fixed
- Heading content range no longer uses `block.content.length`; instead scans the source line directly — handles extra spaces, tabs, ATX-closed headings, and trailing whitespace correctly.
- Dead `blockSource` parameter removed from `walkInline`.
- Heading level bound check added (`1..6`).
- Config (`syntaxMarkers`, `maxDocumentLines`) now cached in the decorator and refreshed only on `onDidChangeConfiguration`, not on every selection change.
- Activation no longer calls `clear()` on non-markdown editors.
- Heading decorations no longer inject `font-size` CSS, which painted larger text without updating VS Code's word-wrap layout.

## [0.1.0] — Initial releases

### Added (2438898)
- Default `syntaxMarkers` changed to `hidden`.

### Added (00b714f)
- `livemarks.syntaxMarkers` config key (`dimmed` | `hidden`).

### Added (15aebc7)
- README.

### Added (ca3c548)
- H1–H6 heading decorations with font-size scaling.
- Renamed extension to Livemarks.

### Added (f9c67b7)
- Initial extension: bold, italic, strikethrough decorations in markdown editors.
