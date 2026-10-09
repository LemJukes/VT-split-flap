// Split-flap board logic: symbol stepping, the update wave, URL options, minute scheduling and
// the run queue. No DOM and no timers, so node --test can load it exactly as the page does.
// A classic script (not a module) that defines the global SplitFlapLogic.
(function (global) {
    'use strict';

    // Every module carries the same drum: blank, then A to Z, then round to blank again.
    const SYMBOLS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const LEVELS = ['verbose', 'lengthy', 'short', 'terse'];
    const DEFAULT_LEVEL = 'verbose';
    const BOOT_MESSAGE = 'VERBA TEMPUS A CLOCK FULL OF WORDS';

    const MIN_INTERVAL_MS = 250;
    const MAX_TIMER_MS = 2147483647; // longer setTimeout/setInterval delays fire immediately

    // Step durations: a slow first turn, then the module spins up.
    const FIRST_STEP_MS = 280;
    const SECOND_STEP_MS = 130;
    const FASTEST_STEP_MS = 100;
    const SPIN_UP_MS_PER_STEP = 6;

    // Position of a symbol on the drum. Anything that is not on it counts as blank.
    function symbolIndex(symbol) {
        if (typeof symbol !== 'string' || symbol.length !== 1) {
            return 0;
        }

        const index = SYMBOLS.indexOf(symbol);
        return index === -1 ? 0 : index;
    }

    function nextSymbol(symbol) {
        return SYMBOLS[(symbolIndex(symbol) + 1) % SYMBOLS.length];
    }

    // Forward steps from one symbol to another (0 to 26). The drum never turns backwards.
    function stepsBetween(from, to) {
        return (symbolIndex(to) - symbolIndex(from) + SYMBOLS.length) % SYMBOLS.length;
    }

    // The symbols a module shows after each step, ending on `to`. Empty when nothing changes.
    // symbolPath('Y', 'B') -> ['Z', ' ', 'A', 'B']
    function symbolPath(from, to) {
        const path = [];
        let index = symbolIndex(from);

        for (let remaining = stepsBetween(from, to); remaining > 0; remaining -= 1) {
            index = (index + 1) % SYMBOLS.length;
            path.push(SYMBOLS[index]);
        }

        return path;
    }

    // Fixed per-cell jitter, -42 to +42 ms, so the wave is not perfectly regular.
    function waveVariance(row, column) {
        return ((((row + 1) * 17) + ((column + 1) * 31)) % 7 - 3) * 14;
    }

    // How long a cell waits after an update starts before its first step (row, column 0-based).
    function waveDelay(row, column) {
        return Math.max(0, 220 + row * 72 + column * 28 + waveVariance(row, column));
    }

    // Duration of a cell's step number `step` (0-based) within one run.
    function stepDuration(step) {
        if (step <= 0) {
            return FIRST_STEP_MS;
        }

        return Math.max(FASTEST_STEP_MS, SECOND_STEP_MS - (step - 1) * SPIN_UP_MS_PER_STEP);
    }

    // Every cell that has to move to get from `shown` to `target` (both flat, row-major strings),
    // with the symbols it steps through and its wave delay. Cells already on target are left out.
    function planRun(shown, target, columns) {
        const moves = [];

        for (let index = 0; index < target.length; index += 1) {
            const from = index < shown.length ? shown[index] : SYMBOLS[0];
            const path = symbolPath(from, target[index]);

            if (path.length === 0) {
                continue;
            }

            const row = Math.floor(index / columns);
            const column = index % columns;
            moves.push({ index, row, column, path, delay: waveDelay(row, column) });
        }

        return moves;
    }

    function parseInterval(raw) {
        if (raw === null || raw.trim() === '') {
            return null;
        }

        const value = Number(raw);
        const usable = Number.isFinite(value) && value >= MIN_INTERVAL_MS && value <= MAX_TIMER_MS;
        return usable ? value : null;
    }

    // ?level=verbose|lengthy|short|terse (any case; otherwise verbose),
    // ?interval=N (ms, at least 250; otherwise null, meaning "on the minute"),
    // ?phrase=... (raw text, or null when absent).
    function parseOptions(search) {
        const params = new URLSearchParams(search || '');
        const requestedLevel = (params.get('level') || '').trim().toLowerCase();

        return {
            level: LEVELS.includes(requestedLevel) ? requestedLevel : DEFAULT_LEVEL,
            interval: parseInterval(params.get('interval')),
            phrase: params.has('phrase') ? params.get('phrase') : null
        };
    }

    // Milliseconds from `now` to the next wall-clock :00 (1 to 60000).
    function msUntilNextMinute(now) {
        return 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    }

    // Board height: enough rows for every time phrase at `level` and for the boot message.
    function rowsNeeded(layout, format, level, columns, bootText) {
        return Math.max(
            layout.rowsForLevel(format, level, columns),
            layout.wrapWords(bootText, columns).length
        );
    }

    // Laid-out rows back to a phrase for assistive tech: 'VERBA TEMPUS A CLOCK FULL OF WORDS'.
    function readableText(rows) {
        return Array.from(rows).join(' ').replace(/\s+/g, ' ').trim();
    }

    // Serialises runs. A run is never interrupted: a target requested while one is under way is
    // parked, a later request replaces it, and when the run ends the parked target starts a new
    // run unless the board already shows it.
    //   readShown()  -> the flat text the cells show now
    //   run(target)  -> starts moving the cells; returns a promise that settles once every cell
    //                   has landed, or nothing if the board was set at once (e.g. reduced motion)
    function createUpdateQueue({ initialTarget, readShown, run }) {
        let latest = initialTarget;
        let running = false;
        let parked = null;

        function launch(target) {
            if (target === readShown()) {
                return;
            }

            const work = run(target);

            if (!work || typeof work.then !== 'function') {
                return;
            }

            running = true;
            work.then(finish, (error) => {
                finish();
                throw error;
            });
        }

        function finish() {
            running = false;
            const next = parked;
            parked = null;

            if (next !== null) {
                launch(next);
            }
        }

        return {
            request(target) {
                latest = target;

                if (running) {
                    parked = target;
                    return;
                }

                launch(target);
            },
            latestTarget() {
                return latest;
            },
            isIdle() {
                return !running && parked === null;
            }
        };
    }

    global.SplitFlapLogic = Object.freeze({
        SYMBOLS,
        LEVELS,
        DEFAULT_LEVEL,
        BOOT_MESSAGE,
        MIN_INTERVAL_MS,
        symbolIndex,
        nextSymbol,
        stepsBetween,
        symbolPath,
        waveVariance,
        waveDelay,
        stepDuration,
        planRun,
        parseOptions,
        msUntilNextMinute,
        rowsNeeded,
        readableText,
        createUpdateQueue
    });
})(globalThis);
