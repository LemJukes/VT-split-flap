# Verba Tempus - A Word Clock with Split-Flap Display

A web-based word clock that displays the current time using natural language phrases on a split-flap display board animation, reminiscent of old airport and train station departure boards.

## Overview

Verba Tempus (Latin for "time words") shows the current time using phrases like:
- "IT IS THREE OCLOCK IN THE AFTERNOON"
- "IT IS A QUARTER PAST SEVEN OCLOCK IN THE EVENING"
- "IT IS TEN TILL MIDNIGHT"

The display uses an animated split-flap board effect, where individual characters flip through the alphabet to reveal new text.

## Options

Add these to the page URL:
- `?level=verbose` (default), `lengthy`, `short` or `terse` - how wordy the clock is
- `?phrase=HELLO WORLD` - show fixed text instead of the time
- `?interval=5000` - re-check every N milliseconds instead of on each minute

The board is 12 columns wide and exactly as tall as the chosen level needs, so no phrase is ever cut off: verbose 6 rows, lengthy 5, short 4, terse 3.

## Technical Details

- Vanilla JavaScript, no build step and no external requests: everything the page loads is in this repository
- Phrasing comes from the [verbatempus](https://www.npmjs.com/package/verbatempus) library, as its browser bundle in `vendor/`
- Uses CSS animations for the split-flap effect
- Updates on the minute boundary

## Running Locally

1. Clone the repository
2. Open index.html in a web browser, or serve the folder with any static file server
3. The display will show a welcome message before transitioning to the current time

Tests (Node 20+): `node --test`

## Updating verbatempus

`vendor/verbatempus.iife.js` is copied unmodified from the published npm package:

```sh
npm pack verbatempus@<version>
tar -xzf verbatempus-<version>.tgz package/dist/verbatempus.iife.js
```

Copy `package/dist/verbatempus.iife.js` over `vendor/verbatempus.iife.js`, then run `node --test`.

## Credits

The split-flap display animation code is based on Noah Veltman's "Departures board" implementation:
- Original code: https://gist.github.com/veltman/f2b2a06d4ffa62f4d39d5ebac5ceeef0
- Author: Noah Veltman (@veltman on GitHub)

Roboto Condensed is by Google, under the SIL Open Font License 1.1.

## License

This project is available under the MIT License. The split-flap animation code is used with permission under its original MIT License from Noah Veltman. See LICENSE for all notices.
