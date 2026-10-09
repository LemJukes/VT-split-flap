// VT-split-flap: the board.
// Builds a grid of flap modules, turns each one forward a symbol at a time with the Web Animations
// API, and keeps the board on the time (or on ?phrase=). A classic script: it relies on the globals
// Verbatempus (vendor/verbatempus.iife.js), SplitFlapLayout (layout.js) and SplitFlapLogic
// (board-logic.js), which index.html loads before it.
(function () {
    'use strict';

    const Clock = window.Verbatempus;
    const Layout = window.SplitFlapLayout;
    const Logic = window.SplitFlapLogic;

    const COLUMNS = 12;
    const FIRST_UPDATE_MS = 2200;

    // One step: the upper leaf swings half a turn about the hinge, forward and down.
    const LEAF_FALL = [
        { transform: 'rotateX(0deg)' },
        { transform: 'rotateX(-180deg)' }
    ];

    // The leaf dims as it turns away from the light. These share LEAF_FALL's timing, so offset 0.5
    // is the moment the leaf stands vertical and its front face goes edge-on.
    const DIMMED = 'brightness(0.7)';
    const LIT = 'brightness(1)';
    const FRONT_DIMMING = [
        { offset: 0, filter: LIT },
        { offset: 0.5, filter: DIMMED },
        { offset: 1, filter: DIMMED }
    ];
    const BACK_BRIGHTENING = [
        { offset: 0, filter: DIMMED },
        { offset: 0.5, filter: DIMMED },
        { offset: 1, filter: LIT }
    ];

    // Slow to leave the stack, quicker as it drops.
    const FALL_EASING = 'cubic-bezier(0.5, 0.05, 0.8, 0.5)';

    const options = Logic.parseOptions(window.location.search);
    const rowCount = Logic.rowsNeeded(Layout, Clock.format, options.level, COLUMNS, Logic.BOOT_MESSAGE);
    const motionQuery = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

    // ---- DOM -------------------------------------------------------------------------------

    function make(tag, className) {
        const node = document.createElement(tag);
        node.className = className;
        return node;
    }

    // A half-height flap surface holding one full-height glyph, of which it shows the top
    // (sf-panel--top) or the bottom (sf-panel--bottom).
    function makePanel(className) {
        const face = make('div', 'sf-panel ' + className);
        const glyph = make('span', 'sf-glyph');
        face.appendChild(glyph);
        return { face, glyph };
    }

    // One module: fixed upper and lower halves, the hinge line, and a leaf that is only shown
    // while turning. The leaf's front looks like an upper half and its back like a lower half.
    function makeCell(symbol) {
        const slot = make('div', 'sf-slot');
        const module = make('div', 'sf-module');
        const upper = makePanel('sf-panel--top sf-upper');
        const lower = makePanel('sf-panel--bottom sf-lower');
        const leaf = make('div', 'sf-leaf');
        const front = makePanel('sf-panel--top sf-leaf-front');
        const back = makePanel('sf-panel--bottom sf-leaf-back');

        leaf.appendChild(front.face);
        leaf.appendChild(back.face);
        module.appendChild(upper.face);
        module.appendChild(lower.face);
        module.appendChild(leaf);
        module.appendChild(make('div', 'sf-hinge'));
        slot.appendChild(module);

        const cell = { slot, module, upper, lower, leaf, front, back, symbol: Layout.BLANK_CHARACTER };
        restOn(cell, symbol);
        return cell;
    }

    // Show `symbol` on both halves, with no motion.
    function restOn(cell, symbol) {
        cell.symbol = symbol;
        cell.upper.glyph.textContent = symbol;
        cell.lower.glyph.textContent = symbol;
    }

    function buildBoard(host, text) {
        const frame = make('div', 'sf-board');
        frame.setAttribute('role', 'img');

        const grid = make('div', 'sf-grid');
        grid.setAttribute('aria-hidden', 'true');
        grid.style.setProperty('--sf-columns', String(COLUMNS));

        const cells = [];
        for (let index = 0; index < text.length; index += 1) {
            const cell = makeCell(text[index]);
            cells.push(cell);
            grid.appendChild(cell.slot);
        }

        frame.appendChild(grid);
        host.appendChild(frame);
        return { frame, cells };
    }

    // ---- Motion ----------------------------------------------------------------------------

    function prefersReducedMotion() {
        return Boolean(motionQuery && motionQuery.matches);
    }

    function pause(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // One step from the symbol the cell shows to `next`. Before the leaf moves, the upper half
    // behind it already shows `next`; the leaf's front shows the old top and its back the new
    // bottom. When the leaf lands it covers the lower half exactly, so the lower half can switch
    // to `next` and the leaf can be hidden in the same frame.
    async function turnOnce(cell, next, duration) {
        cell.front.glyph.textContent = cell.symbol;
        cell.back.glyph.textContent = next;
        cell.upper.glyph.textContent = next;
        cell.module.classList.add('is-turning');

        const timing = { duration, easing: FALL_EASING, fill: 'forwards' };
        const motions = [
            cell.leaf.animate(LEAF_FALL, timing),
            cell.front.face.animate(FRONT_DIMMING, timing),
            cell.back.face.animate(BACK_BRIGHTENING, timing)
        ];

        try {
            await Promise.all(motions.map((motion) => motion.finished));
        } catch (error) {
            // Cancelled from outside (AbortError): land the flap anyway. Anything else is a bug.
            if (!error || error.name !== 'AbortError') {
                throw error;
            }
        }

        cell.lower.glyph.textContent = next;
        cell.symbol = next;
        cell.module.classList.remove('is-turning');
        motions.forEach((motion) => motion.cancel());
    }

    // Wait for the cell's turn in the wave, then step through `path` one symbol at a time.
    async function spin(cell, path, delay) {
        await pause(delay);

        for (let step = 0; step < path.length; step += 1) {
            if (prefersReducedMotion()) {
                restOn(cell, path[path.length - 1]);
                return;
            }

            await turnOnce(cell, path[step], Logic.stepDuration(step));
        }
    }

    // Start a run towards the flat `target`. Returns a promise that settles when every moving
    // cell has landed, or null when there was nothing to animate.
    function runTowards(target) {
        const moves = Logic.planRun(shownText(), target, COLUMNS);

        if (moves.length === 0) {
            return null;
        }

        if (!canAnimate || prefersReducedMotion()) {
            moves.forEach((move) => restOn(cells[move.index], move.path[move.path.length - 1]));
            return null;
        }

        return Promise.all(moves.map((move) => spin(cells[move.index], move.path, move.delay)));
    }

    // ---- Board state -----------------------------------------------------------------------

    function shownText() {
        return cells.map((cell) => cell.symbol).join('');
    }

    function announce(rows) {
        frame.setAttribute('aria-label', Logic.readableText(rows));
    }

    let phraseRows = null; // ?phrase= never changes, so it is laid out (and warned about) once

    function layoutTarget() {
        if (options.phrase !== null) {
            if (phraseRows === null) {
                phraseRows = Layout.splitIntoRows(Layout.normalizeText(options.phrase), COLUMNS, rowCount);
            }
            return phraseRows;
        }

        const text = Clock.format(new Date(), { level: options.level, case: 'upper', charset: 'alpha' });
        return Layout.splitIntoRows(text, COLUMNS, rowCount);
    }

    function update() {
        const rows = layoutTarget();
        announce(rows);
        queue.request(rows.join(''));
    }

    // ---- Start -----------------------------------------------------------------------------

    const bootRows = Layout.splitIntoRows(Logic.BOOT_MESSAGE, COLUMNS, rowCount);
    const host = document.querySelector('.container') || document.body;
    const { frame, cells } = buildBoard(host, bootRows.join(''));
    announce(bootRows);

    const queue = Logic.createUpdateQueue({
        initialTarget: bootRows.join(''),
        readShown: shownText,
        run: runTowards
    });

    // Default: on every wall-clock minute, re-armed each time so it never drifts.
    function onMinute() {
        setTimeout(onMinute, Logic.msUntilNextMinute(new Date()));
        update();
    }

    setTimeout(() => {
        if (options.interval !== null) {
            update();
            setInterval(update, options.interval);
        } else {
            onMinute();
        }
    }, FIRST_UPDATE_MS);

    window.SplitFlapBoard = Object.freeze({
        rows: rowCount,
        columns: COLUMNS,
        level: options.level,
        shownText,
        targetText: () => queue.latestTarget(),
        isIdle: () => queue.isIdle()
    });
})();
