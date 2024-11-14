# Verba Tempus - A Word Clock with Split-Flap Display

A web-based word clock that displays the current time using natural language phrases on a split-flap display board animation, reminiscent of old airport and train station departure boards.

## Overview

Verba Tempus (Latin for "time words") shows the current time using phrases like:
- "IT IS NOW THREE O'CLOCK IN THE AFTERNOON"
- "IT IS NOW QUARTER PAST SEVEN"
- "IT IS NOW TEN MINUTES TO MIDNIGHT"

The display uses an animated split-flap board effect, where individual characters flip through the alphabet to reveal new text.

## Technical Details

- Built with vanilla JavaScript and D3.js
- Uses CSS animations for the split-flap effect
- Modular design separating time logic from display animations
- Responsive layout that works across different screen sizes

## Credits

The split-flap display animation code is based on Noah Veltman's "Departures board" implementation:
- Original code: https://gist.github.com/veltman/f2b2a06d4ffa62f4d39d5ebac5ceeef0
- Author: Noah Veltman (@veltman on GitHub)

## Running Locally

1. Clone the repository
2. Open index.html in a web browser
3. The display will show a welcome message before transitioning to the current time
4. Updates automatically every minute

## License

This project is available under the MIT License. The split-flap animation code is used with permission under its original MIT License from Noah Veltman.