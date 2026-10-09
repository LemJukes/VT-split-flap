// Run with: node --test
// Loads the vendored verbatempus bundle and layout.js exactly as the page does (classic scripts),
// then checks every phrase the board can show against the board's size.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const warnings = [];
const page = vm.createContext({ console: { warn: (...args) => warnings.push(args) } });
vm.runInContext(read('vendor/verbatempus.iife.js'), page);
vm.runInContext(read('layout.js'), page);
vm.runInContext('this.Verbatempus = Verbatempus;', page);

const { Verbatempus, SplitFlapLayout } = page;
const { rowsForLevel } = SplitFlapLayout;
// arrays from the page context have that context's Array prototype; copy them into this one
const wrapWords = (...args) => [...SplitFlapLayout.wrapWords(...args)];
const splitIntoRows = (...args) => [...SplitFlapLayout.splitIntoRows(...args)];
const COLUMNS = 12;
const LEVELS = ['verbose', 'lengthy', 'short', 'terse'];
const boardText = (h, m, level) => Verbatempus.format(
    vm.runInContext(`new Date(2026, 0, 1, ${h}, ${m})`, page),
    { level, case: 'upper', charset: 'alpha' }
);

function everyMinute(fn) {
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m++) fn(h, m);
    }
}

test('vendored bundle is verbatempus 2.x', () => {
    assert.match(read('vendor/verbatempus.iife.js'), /^\/\*! verbatempus v2\./);
});

describe('board size per level at 12 columns', () => {
    // phrasing-spec-v2 section 4: verbose 6, lengthy 5, short 4, terse 3
    const expected = { verbose: 6, lengthy: 5, short: 4, terse: 3 };
    for (const level of LEVELS) {
        test(`${level} needs ${expected[level]} rows, within the classic 6x12 board`, () => {
            assert.equal(rowsForLevel(Verbatempus.format, level, COLUMNS), expected[level]);
            assert.ok(expected[level] <= 6);
        });
    }

    test('the boot message fits in 3 rows', () => {
        assert.deepEqual(wrapWords('VERBA TEMPUS A CLOCK FULL OF WORDS', COLUMNS),
            ['VERBA TEMPUS', 'A CLOCK FULL', 'OF WORDS']);
    });
});

describe('every phrase at every level', () => {
    for (const level of LEVELS) {
        test(`${level}: all 1440 minutes fit, A-Z and space only, within MAX_LENGTH`, () => {
            const rows = rowsForLevel(Verbatempus.format, level, COLUMNS);
            const max = Verbatempus.MAX_LENGTH[level].time;
            warnings.length = 0;
            everyMinute((h, m) => {
                const text = boardText(h, m, level);
                assert.match(text, /^[A-Z]+( [A-Z]+)*$/, text);
                assert.ok(text.length <= max, text);
                splitIntoRows(text, COLUMNS, rows);
            });
            assert.equal(warnings.length, 0, 'a phrase was truncated');
        });
    }
});

describe('the old forked engine bugs are gone', () => {
    test('no OCLOCK after MIDNIGHT or NOON', () => {
        for (const level of LEVELS) {
            assert.doesNotMatch(boardText(0, 0, level), /OCLOCK/);
            assert.doesNotMatch(boardText(12, 0, level), /OCLOCK/);
        }
    });

    test('minute 17 is SEVENTEEN, not SEVEN TEEN', () => {
        assert.equal(boardText(14, 17, 'verbose'), 'IT IS SEVENTEEN MINUTES PAST TWO OCLOCK IN THE AFTERNOON');
    });

    test('the time-of-day suffix is on every non-landmark minute, not only :00', () => {
        everyMinute((h, m) => {
            const text = boardText(h, m, 'verbose');
            if (!/MIDNIGHT|NOON/.test(text)) assert.match(text, /IN THE (MORNING|AFTERNOON|EVENING)$/, text);
            assert.doesNotMatch(text, /IN THE AFTER NOON/);
        });
    });
});

describe('layout', () => {
    test('pads to the full board', () => {
        assert.deepEqual(splitIntoRows('ITS NOON', COLUMNS, 3), ['ITS NOON    ', ' '.repeat(12), ' '.repeat(12)]);
    });

    test('splits a word longer than a row', () => {
        assert.deepEqual(wrapWords('ABCDEFGHIJKLMNOP', COLUMNS), ['ABCDEFGHIJKL', 'MNOP']);
    });

    test('truncates overflow with a warning', () => {
        warnings.length = 0;
        assert.equal(splitIntoRows('ONE TWO THREE FOUR FIVE SIX', 5, 2).length, 2);
        assert.equal(warnings.length, 1);
    });
});
