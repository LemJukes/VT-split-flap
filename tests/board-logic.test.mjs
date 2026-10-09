// Run with: node --test
// Loads board-logic.js (with the vendored bundle and layout.js it is used with) into a vm context
// as classic scripts, the way the page loads them, then checks symbol stepping, the update wave,
// URL options, minute scheduling and the run queue that handles overlapping updates.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const page = vm.createContext({ URLSearchParams, console: { warn: () => {} } });
vm.runInContext(read('vendor/verbatempus.iife.js'), page);
vm.runInContext(read('layout.js'), page);
vm.runInContext(read('board-logic.js'), page);
vm.runInContext('this.Verbatempus = Verbatempus;', page);

const { Verbatempus, SplitFlapLayout, SplitFlapLogic: Logic } = page;
// values from the page context carry that context's prototypes; copy them into this one
const plain = (value) => JSON.parse(JSON.stringify(value));
const COLUMNS = 12;

describe('symbols', () => {
    test('blank, then A to Z: 27 symbols', () => {
        assert.equal(Logic.SYMBOLS, ' ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });

    test('next symbol wraps from Z to blank to A', () => {
        assert.equal(Logic.nextSymbol(' '), 'A');
        assert.equal(Logic.nextSymbol('M'), 'N');
        assert.equal(Logic.nextSymbol('Z'), ' ');
    });

    test('Y to B goes Z, blank, A, B', () => {
        assert.deepEqual(plain(Logic.symbolPath('Y', 'B')), ['Z', ' ', 'A', 'B']);
    });

    test('a cell already on target does not move', () => {
        for (const symbol of Logic.SYMBOLS) {
            assert.deepEqual(plain(Logic.symbolPath(symbol, symbol)), []);
        }
    });

    test('every path only moves forward, one symbol per step, and ends on target', () => {
        for (const from of Logic.SYMBOLS) {
            for (const to of Logic.SYMBOLS) {
                const path = plain(Logic.symbolPath(from, to));
                assert.equal(path.length, Logic.stepsBetween(from, to));
                assert.ok(path.length <= 26);
                let previous = from;
                for (const symbol of path) {
                    assert.equal(symbol, Logic.nextSymbol(previous));
                    previous = symbol;
                }
                assert.equal(previous, to);
            }
        }
    });

    test('going one back takes the long way round', () => {
        assert.equal(Logic.stepsBetween('B', 'A'), 26);
        assert.equal(Logic.stepsBetween('A', ' '), 26);
    });
});

describe('wave', () => {
    const specDelay = (row, column) => {
        const variance = ((((row + 1) * 17) + ((column + 1) * 31)) % 7 - 3) * 14;
        return Math.max(0, 220 + row * 72 + column * 28 + variance);
    };

    test('matches the spec formula on every cell of the largest board', () => {
        for (let row = 0; row < 6; row++) {
            for (let column = 0; column < COLUMNS; column++) {
                assert.equal(Logic.waveDelay(row, column), specDelay(row, column), `${row},${column}`);
                assert.ok(Logic.waveDelay(row, column) >= 0);
            }
        }
    });

    test('known values', () => {
        assert.equal(Logic.waveDelay(0, 0), 262);
        assert.equal(Logic.waveDelay(1, 0), 278);
        assert.equal(Logic.waveDelay(0, 1), 234);
        assert.equal(Logic.waveDelay(5, 11), 916);
    });

    test('variance stays within -42..42 ms', () => {
        for (let row = 0; row < 20; row++) {
            for (let column = 0; column < 20; column++) {
                const variance = Logic.waveVariance(row, column);
                assert.ok(variance >= -42 && variance <= 42);
            }
        }
    });
});

describe('step durations', () => {
    test('first step 250-300 ms, later steps 100-130 ms and never slower than the one before', () => {
        assert.ok(Logic.stepDuration(0) >= 250 && Logic.stepDuration(0) <= 300);
        for (let step = 1; step < 27; step++) {
            const duration = Logic.stepDuration(step);
            assert.ok(duration >= 100 && duration <= 130, `step ${step}: ${duration}`);
            assert.ok(duration <= Logic.stepDuration(step - 1));
        }
    });
});

describe('planRun', () => {
    test('lists only the cells that change, with their path and wave delay', () => {
        const moves = plain(Logic.planRun('AB  ', 'BB Y', 2));
        assert.deepEqual(moves, [
            { index: 0, row: 0, column: 0, path: ['B'], delay: Logic.waveDelay(0, 0) },
            { index: 3, row: 1, column: 1, path: [...'ABCDEFGHIJKLMNOPQRSTUVWXY'], delay: Logic.waveDelay(1, 1) }
        ]);
    });

    test('nothing to do when the board already shows the target', () => {
        assert.deepEqual(plain(Logic.planRun('IT IS NOON  ', 'IT IS NOON  ', COLUMNS)), []);
    });
});

describe('URL options', () => {
    const parse = (search) => plain(Logic.parseOptions(search));

    test('defaults', () => {
        assert.deepEqual(parse(''), { level: 'verbose', interval: null, phrase: null });
    });

    test('level is case-insensitive; missing or unknown means verbose', () => {
        assert.equal(parse('?level=TeRsE').level, 'terse');
        assert.equal(parse('?level=short').level, 'short');
        assert.equal(parse('?level=Lengthy').level, 'lengthy');
        assert.equal(parse('?level=loud').level, 'verbose');
        assert.equal(parse('?level=').level, 'verbose');
    });

    test('interval needs a number of at least 250', () => {
        assert.equal(parse('?interval=250').interval, 250);
        assert.equal(parse('?interval=1000').interval, 1000);
        assert.equal(parse('?interval=249').interval, null);
        assert.equal(parse('?interval=0').interval, null);
        assert.equal(parse('?interval=-500').interval, null);
        assert.equal(parse('?interval=soon').interval, null);
        assert.equal(parse('?interval=').interval, null);
        assert.equal(parse('?interval=Infinity').interval, null);
    });

    test('phrase is passed through raw when present', () => {
        assert.equal(parse('?phrase=hello+world').phrase, 'hello world');
        assert.equal(parse('?phrase=time%20for%20tea&level=terse').phrase, 'time for tea');
        assert.equal(parse('phrase=no+question+mark').phrase, 'no question mark');
        assert.equal(parse('?level=short').phrase, null);
    });
});

describe('minute schedule', () => {
    test('time left until the next :00', () => {
        assert.equal(Logic.msUntilNextMinute(new Date(2026, 0, 1, 10, 30, 15, 250)), 44750);
        assert.equal(Logic.msUntilNextMinute(new Date(2026, 0, 1, 10, 30, 59, 999)), 1);
        assert.equal(Logic.msUntilNextMinute(new Date(2026, 0, 1, 10, 30, 0, 0)), 60000);
    });
});

describe('board size', () => {
    test('rows per level, never fewer than the boot message needs', () => {
        const expected = { verbose: 6, lengthy: 5, short: 4, terse: 3 };
        for (const [level, rows] of Object.entries(expected)) {
            assert.equal(
                Logic.rowsNeeded(SplitFlapLayout, Verbatempus.format, level, COLUMNS, Logic.BOOT_MESSAGE),
                rows
            );
        }
        assert.equal(SplitFlapLayout.wrapWords(Logic.BOOT_MESSAGE, COLUMNS).length, 3);
    });

    test('readable text for assistive tech', () => {
        const rows = SplitFlapLayout.splitIntoRows(Logic.BOOT_MESSAGE, COLUMNS, 6);
        assert.equal(Logic.readableText(rows), 'VERBA TEMPUS A CLOCK FULL OF WORDS');
    });
});

describe('overlapping updates', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    // A board whose runs end only when the test says so.
    function harness(initialShown) {
        const state = { shown: initialShown, runs: [], endRun: null };
        const queue = Logic.createUpdateQueue({
            initialTarget: initialShown,
            readShown: () => state.shown,
            run: (target) => {
                state.runs.push(target);
                return new Promise((resolve) => {
                    state.endRun = () => {
                        state.shown = target;
                        resolve();
                    };
                });
            }
        });
        const finishRun = async () => {
            state.endRun();
            await flush();
        };
        return { state, queue, finishRun };
    }

    test('an idle board starts a run at once', () => {
        const { state, queue } = harness('AAAA');
        assert.equal(queue.isIdle(), true);
        assert.equal(queue.latestTarget(), 'AAAA');
        queue.request('BBBB');
        assert.deepEqual(state.runs, ['BBBB']);
        assert.equal(queue.isIdle(), false);
        assert.equal(queue.latestTarget(), 'BBBB');
    });

    test('updates during a run are not started; only the latest is kept and run afterwards', async () => {
        const { state, queue, finishRun } = harness('AAAA');
        queue.request('BBBB');
        queue.request('CCCC');
        queue.request('DDDD');
        assert.deepEqual(state.runs, ['BBBB']);
        assert.equal(queue.latestTarget(), 'DDDD');
        assert.equal(queue.isIdle(), false);

        await finishRun();
        assert.equal(state.shown, 'BBBB');
        assert.deepEqual(state.runs, ['BBBB', 'DDDD']);
        assert.equal(queue.isIdle(), false);

        await finishRun();
        assert.equal(state.shown, 'DDDD');
        assert.deepEqual(state.runs, ['BBBB', 'DDDD']);
        assert.equal(queue.isIdle(), true);
    });

    test('no new run when the latest target is what the finished run shows', async () => {
        const { state, queue, finishRun } = harness('AAAA');
        queue.request('BBBB');
        queue.request('CCCC');
        queue.request('BBBB');
        await finishRun();
        assert.deepEqual(state.runs, ['BBBB']);
        assert.equal(queue.isIdle(), true);
    });

    test('a target the board already shows starts nothing', () => {
        const { state, queue } = harness('AAAA');
        queue.request('AAAA');
        assert.deepEqual(state.runs, []);
        assert.equal(queue.isIdle(), true);
    });

    test('a run that completes at once (reduced motion) leaves the board idle', () => {
        let shown = 'AAAA';
        const queue = Logic.createUpdateQueue({
            initialTarget: shown,
            readShown: () => shown,
            run: (target) => {
                shown = target;
                return null;
            }
        });
        queue.request('ZZZZ');
        assert.equal(shown, 'ZZZZ');
        assert.equal(queue.isIdle(), true);
        assert.equal(queue.latestTarget(), 'ZZZZ');
    });
});
