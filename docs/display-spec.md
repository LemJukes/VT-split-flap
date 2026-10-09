# VT-split-flap display: behaviour spec

This document is the complete brief for `script.js` and `styles.css`. It describes what the display
must do and how it must look, not how any existing implementation does it. The implementation is
written from this document alone (see "Provenance rules").

## Environment

`index.html` loads, in order, as classic scripts (no ES modules, no build step):

1. `vendor/verbatempus.iife.js`, which defines the global `Verbatempus`
2. `layout.js`, which defines the global `SplitFlapLayout`
3. `script.js`, the board (to be written)

plus `styles.css` (to be written). The page must work when served as static files, and must make
no network requests beyond its own files. No libraries or dependencies.

### APIs you can rely on

```js
Verbatempus.format(date, { level, case: 'upper', charset: 'alpha' })
// -> e.g. 'IT IS A QUARTER TO MIDNIGHT'. Only A-Z and single spaces.
// level: 'verbose' | 'lengthy' | 'short' | 'terse'

SplitFlapLayout.BLANK_CHARACTER                       // ' '
SplitFlapLayout.normalizeText(text)                   // uppercase, non A-Z -> space, collapse spaces
SplitFlapLayout.wrapWords(text, columns)              // -> array of row strings, unpadded, any length
SplitFlapLayout.splitIntoRows(text, columns, rows)    // -> exactly `rows` strings, each padded to
                                                      //    `columns`; truncates (with console.warn)
SplitFlapLayout.splitDisplay(display, columns)        // flat string -> array of row strings
SplitFlapLayout.rowsForLevel(Verbatempus.format, level, columns)
                                                      // -> rows needed so no time phrase at that
                                                      //    level is ever truncated
```

Do not modify `layout.js`, `vendor/`, `fonts/` or `tests/layout.test.mjs`.

## Board

- 12 columns.
- Rows = the larger of `rowsForLevel(Verbatempus.format, level, 12)` and the rows needed by the boot
  message (below). This gives verbose 6, lengthy 5, short 4, terse 3.
- Each cell shows one symbol from this ordered set of 27: space, then `A` to `Z`. After `Z` comes
  space, then `A` again.

## Behaviour

1. **Boot.** On load the board immediately shows `VERBA TEMPUS A CLOCK FULL OF WORDS`, laid out with
   `splitIntoRows`, with no animation.
2. **First update** about 2.2 seconds after load.
3. **Target text.** If the URL has `?phrase=…`, use `normalizeText` of that. Otherwise
   `Verbatempus.format(new Date(), { level, case: 'upper', charset: 'alpha' })`. Lay it out with
   `splitIntoRows(text, 12, rows)`.
4. **Schedule.** By default, update exactly at every wall-clock minute boundary: after the first
   update, set a timeout for the time left until the next `:00`, update, and re-arm. Do not use a
   fixed 60-second interval, which drifts with the load time. With `?interval=N` (a number ≥ 250),
   update every N milliseconds instead.
5. **Level.** `?level=verbose|lengthy|short|terse`, case-insensitive. Missing or invalid means
   `verbose`.
6. **Changing a cell.** A cell moves forward through the symbol set one symbol per step, from what it
   shows now until it shows its target. It never moves backwards. For example, `Y` to `B` goes
   Y, Z, space, A, B. Cells already showing their target do not move.
7. **What a step looks like.** This should look like a physical split-flap module. The cell is divided
   horizontally at its centre by a hinge line. At rest the upper half shows the top of the current
   symbol and the lower half shows its bottom. In a step from X to Y, the upper half behind the moving
   leaf already shows the top of Y. A leaf hinged on the centre line falls forward and down, showing
   the top of X on its face as it starts. Once past vertical, its other side is visible: the bottom of
   Y, which lands over the lower half. At the end the cell shows Y. The fall should read as 3D (a
   rotation about the horizontal hinge, with perspective) and may darken slightly as it turns.
8. **Speed.** A cell's first step in a run takes about 250-300 ms. Each later step is faster, about
   100-130 ms, as if the module is spinning up.
9. **Wave.** When an update starts, each cell that needs to change waits before its first step:
   `220 + row * 72 + column * 28 + variance` ms, with row and column 0-based.
   `variance = ((((row + 1) * 17) + ((column + 1) * 31)) % 7 - 3) * 14`. This is deterministic, so
   the same cell always gets the same offset. The delay is never negative.
10. **Overlapping updates.** If an update arrives while cells are still moving, do not interrupt them.
    Remember only the most recent target. When every cell has finished, and that target differs from
    what is shown, start a new run towards it.
11. **Reduced motion.** If `prefers-reduced-motion: reduce` matches, skip the stepping and set cells
    straight to their target.
12. **Accessibility.** Screen readers should get the phrase, not 72 single letters: the board carries
    the current target text as its accessible name, and the cells are hidden from assistive tech.
13. **Inspection hook,** for tests and debugging:
    ```js
    window.SplitFlapBoard = {
      rows, columns, level,       // numbers / string as configured
      shownText(),                // what the cells show now: all rows joined, rows * columns chars
      targetText(),               // the laid-out target: all rows joined
      isIdle(),                   // true when no cell is moving and nothing is pending
    };
    ```
14. No console output in normal operation (layout's truncation warning excepted).

## Mechanism requirement

Drive each step with the Web Animations API (`element.animate(...)`, awaiting its `finished`
promise). Do not use infinitely repeating CSS animations, and do not use `animationiteration`
events. Choose your own element structure, class names and function names.

## Visual design

Keep this look. The values are the project's own design tokens.

**Page**
- Full-viewport, content centred, no page scroll on desktop.
- Background: a warm glow from the top, `radial-gradient(circle at top, rgba(205, 162, 72, 0.18), transparent 30%)`,
  over `linear-gradient(180deg, #26211d 0%, #181513 45%, #0f0d0c 100%)`.
- A very faint fixed overlay with soft vertical light bands (white at about 1.5% opacity) and a
  slight central lift (white at 4% fading out by 65%), so the backdrop is not flat.
- Font: `"Roboto Condensed"`, served from `fonts/roboto-condensed-latin-400-normal.woff2`
  (weight 400, `font-display: swap`; declare it with `@font-face`). Glyphs are rendered at weight 700,
  which the browser synthesises; that bolder look is intended.

**Board frame**
- Padding 28px, corner radius 18px.
- Background: `linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 16%)` over
  `linear-gradient(180deg, #4a4338, #191715)`.
- Border 1px `rgba(255, 236, 184, 0.08)`.
- Shadows: `0 32px 80px rgba(0, 0, 0, 0.5)`, inset `0 1px 0 rgba(255, 255, 255, 0.08)`,
  inset `0 -18px 30px rgba(0, 0, 0, 0.35)`.
- An inner hairline 12px in from the edge: radius 10px, 1px `rgba(255, 255, 255, 0.04)`.
- The whole board leans back slightly: tilted 8° about the horizontal axis, with perspective
  around 1400px.

**Cells**
- Each cell occupies 64 × 78 px. The visible module inside is 58 × 68 px, centred horizontally and
  aligned to the top of its cell.
- Each module casts a soft shadow, about `0 10px 12px rgba(0, 0, 0, 0.28)`.
- Module corners are rounded about 7-8px on the outside, tighter (about 2px) where the halves meet
  the hinge.
- Upper half surface: `linear-gradient(180deg, #69645f 0%, #54504c 40%, #494541 100%)`.
- Lower half surface: `linear-gradient(180deg, #3b3734 0%, #35322f 58%, #24211f 100%)`.
- Hinge: a 2px gap across the middle, drawn as a dark line with a faint highlight, and shadow
  `0 0 0 1px rgba(0, 0, 0, 0.45)`.
- A soft glossy highlight band near the top edge: about 14px tall, starting 5px down, white fading
  from 18% to 0, at about 35% opacity.
- Each half has gentle shading: a little lighter at its top, darker toward its bottom (about white 6%
  to black 18%).
- Edges: a 1px inner top highlight (white about 9%), a darker inner bottom edge (black about 35%),
  and a 1px dark outline (black about 30%).

**Glyphs**
- 56px, weight 700, letter-spacing 0.05em, colour `#f1d25f`, text-shadow `0 0 10px rgba(255, 203, 76, 0.15)`.
- Each glyph is centred horizontally. Its vertical position must make the top and bottom halves of
  one character join seamlessly across the hinge. It need not be pixel-identical to anything; it
  must look like one character split by a line.

**Small screens** (max-width 980px)
- No tilt. The board may scroll horizontally inside a container no wider than `100vw - 24px`.

## Tests

`node --test` must pass, including the existing `tests/layout.test.mjs`. If you put pure logic in
its own file (symbol stepping, wave delays, URL options), add `node --test` tests for it next to the
existing one.

## Provenance rules

This display used to be adapted from someone else's code. It is being rewritten independently, so:

- Read only the files named here, plus this document. Do not look at earlier versions of `script.js`
  or `styles.css`: no `git log -p`, `git show`, `git diff`, `git blame`, or checking out older
  commits.
- Do not fetch anything from the network, and do not look at other folders on this computer.
- Do not reproduce any split-flap implementation you may remember. Design it from this spec.
