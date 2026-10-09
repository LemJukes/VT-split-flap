// Needs vendor/verbatempus.iife.js (global Verbatempus) and layout.js (global SplitFlapLayout).
const { BLANK_CHARACTER, normalizeText, wrapWords, splitIntoRows, splitDisplay, rowsForLevel } = SplitFlapLayout;

const LEVELS = ['verbose', 'lengthy', 'short', 'terse'];
const queryParams = new URLSearchParams(window.location.search);
const level = getConfiguredLevel();

const BOARD = {
    rows: 0, // sized below from the phrasing contract
    columns: 12,
    cellWidth: 64,
    cellHeight: 78,
    flapWidth: 58,
    flapHeight: 68,
    halfHeight: 33,
    boardPadding: 28,
    fontSize: 56,
    frontOffset: -4,
    backOffset: -38,
    perspective: 1400,
    timings: {
        bootDelay: 2200,
        initialWaveDelay: 220,
        updateInterval: getConfiguredInterval(),
        rowStagger: 72,
        columnStagger: 28,
        startVariance: 14
    }
};

const INITIAL_MESSAGE = 'VERBA TEMPUS A CLOCK FULL OF WORDS';
const CHARACTER_SET = `${BLANK_CHARACTER}ABCDEFGHIJKLMNOPQRSTUVWXYZ`;
const previewPhrase = normalizeText(queryParams.get('phrase') || '');
const cycle = createCycleMap(CHARACTER_SET);

// Tall enough for the longest phrase this level can produce, so nothing is ever truncated.
BOARD.rows = Math.max(
    rowsForLevel(Verbatempus.format, level, BOARD.columns),
    wrapWords(INITIAL_MESSAGE, BOARD.columns).length
);

let currentRows = splitIntoRows(INITIAL_MESSAGE, BOARD.columns, BOARD.rows);
let currentDisplay = currentRows.join('');
let isAnimating = false;
let queuedDisplay = null;

const container = document.querySelector('.container');
applyBoardVariables(container, BOARD);

const flaps = buildBoard(container, createBoardState(currentRows));

window.setTimeout(() => {
    updateDisplay();

    if (BOARD.timings.updateInterval) {
        window.setInterval(updateDisplay, BOARD.timings.updateInterval);
    } else {
        scheduleNextMinute(updateDisplay);
    }
}, BOARD.timings.bootDelay);

function buildBoard(root, rowData) {
    const built = [];

    rowData.forEach((row) => {
        const rowElement = createElement('div', 'row');

        row.forEach((cell) => {
            const flap = createElement('div', 'flap');
            flap.dataset.row = cell.rowIndex;
            flap.dataset.column = cell.columnIndex;

            ['next', 'prev', 'back', 'front'].forEach((segment) => {
                if (segment === 'front') {
                    flap.appendChild(createElement('div', 'divider'));
                }

                const half = createElement('div', `half ${segment}`);
                const letter = createElement('span');
                letter.textContent = cell.letter;
                half.appendChild(letter);
                flap.appendChild(half);
            });

            rowElement.appendChild(flap);
            built.push({ element: flap, cell });
        });

        root.appendChild(rowElement);
    });

    return built;
}

function updateDisplay() {
    const nextRows = splitIntoRows(getDisplayText(), BOARD.columns, BOARD.rows);
    const nextDisplay = nextRows.join('');

    if (nextDisplay === currentDisplay) {
        return;
    }

    if (isAnimating) {
        queuedDisplay = nextDisplay;
        return;
    }

    flipToDisplay(nextDisplay);
}

function flipToDisplay(targetDisplay) {
    const transitions = [];
    isAnimating = true;

    flaps.forEach(({ element, cell }) => {
        const toLetter = targetDisplay[cell.index] || BLANK_CHARACTER;

        if (cell.letter === toLetter) {
            return;
        }

        transitions.push(scheduleFlip(element, cell, toLetter));
    });

    Promise.all(transitions).then(() => {
        currentDisplay = targetDisplay;
        currentRows = splitDisplay(currentDisplay, BOARD.columns);
        isAnimating = false;

        if (queuedDisplay && queuedDisplay !== currentDisplay) {
            const pendingDisplay = queuedDisplay;
            queuedDisplay = null;
            flipToDisplay(pendingDisplay);
            return;
        }

        queuedDisplay = null;
    });
}

function scheduleFlip(flap, cell, toLetter) {
    const delay = getFlapDelay(cell.rowIndex, cell.columnIndex);

    return new Promise((resolve) => {
        window.setTimeout(() => {
            flipLetter(flap, cell, toLetter, resolve);
        }, delay);
    });
}

function flipLetter(flap, cell, toLetter, resolve) {
    if (cell.letter === toLetter) {
        resolve();
        return;
    }

    const prevFlaps = flap.querySelectorAll('.prev span, .front span');
    const nextFlaps = flap.querySelectorAll('.back span, .next span');
    const frontFace = flap.querySelector('.front');
    let next = getNextCharacter(cell.letter);
    let fastModeEnabled = false;

    frontFace.onanimationiteration = () => {
        if (next === toLetter) {
            cell.letter = toLetter;
            frontFace.onanimationiteration = null;

            flap.classList.remove('animated', 'fast');
            setText(flap.querySelectorAll('span'), toLetter);

            window.setTimeout(resolve, 60);
            return;
        }

        if (!fastModeEnabled) {
            fastModeEnabled = true;
            flap.classList.add('fast');
        }

        setText(prevFlaps, next);
        cell.letter = next;
        next = getNextCharacter(next);

        window.setTimeout(() => {
            setText(nextFlaps, next);
        }, 0);
    };

    flap.classList.add('animated');
    setText(nextFlaps, next);
}

function getDisplayText() {
    if (previewPhrase) {
        return previewPhrase;
    }

    return Verbatempus.format(new Date(), { level, case: 'upper', charset: 'alpha' });
}

// Fire at the top of every minute, not 60s after whenever the page loaded.
function scheduleNextMinute(fn) {
    const delay = 60000 - (Date.now() % 60000);
    window.setTimeout(() => {
        fn();
        scheduleNextMinute(fn);
    }, delay);
}

function createBoardState(rows) {
    return rows.map((row, rowIndex) => row.split('').map((letter, columnIndex) => ({
        rowIndex,
        columnIndex,
        index: rowIndex * BOARD.columns + columnIndex,
        letter
    })));
}

function applyBoardVariables(element, board) {
    const variables = {
        '--board-columns': board.columns,
        '--board-rows': board.rows,
        '--cell-width': `${board.cellWidth}px`,
        '--cell-height': `${board.cellHeight}px`,
        '--flap-width': `${board.flapWidth}px`,
        '--flap-height': `${board.flapHeight}px`,
        '--half-height': `${board.halfHeight}px`,
        '--board-padding': `${board.boardPadding}px`,
        '--board-perspective': `${board.perspective}px`,
        '--display-font-size': `${board.fontSize}px`,
        '--front-letter-offset': `${board.frontOffset}px`,
        '--back-letter-offset': `${board.backOffset}px`,
        '--wave-row-stagger': `${board.timings.rowStagger}ms`,
        '--wave-column-stagger': `${board.timings.columnStagger}ms`
    };

    Object.entries(variables).forEach(([name, value]) => {
        element.style.setProperty(name, String(value));
    });
}

function createElement(tag, className) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    return element;
}

function setText(elements, text) {
    elements.forEach((element) => {
        element.textContent = text;
    });
}

function createCycleMap(characters) {
    const mapping = {};

    for (let index = 0; index < characters.length; index += 1) {
        const character = characters[index];
        const nextCharacter = characters[(index + 1) % characters.length];
        mapping[character] = nextCharacter;
    }

    return mapping;
}

function getNextCharacter(character) {
    return cycle[character] || BLANK_CHARACTER;
}

function getFlapDelay(rowIndex, columnIndex) {
    const waveDelay = BOARD.timings.initialWaveDelay
        + (rowIndex * BOARD.timings.rowStagger)
        + (columnIndex * BOARD.timings.columnStagger);

    return Math.max(0, waveDelay + getMechanicalVariance(rowIndex, columnIndex));
}

function getMechanicalVariance(rowIndex, columnIndex) {
    const seed = ((rowIndex + 1) * 17) + ((columnIndex + 1) * 31);
    const centeredStep = (seed % 7) - 3;

    return centeredStep * BOARD.timings.startVariance;
}

// ?level=short -> 'short'. Missing or unrecognised falls back to 'verbose'.
function getConfiguredLevel() {
    const requested = (queryParams.get('level') || '').toLowerCase();

    return LEVELS.includes(requested) ? requested : 'verbose';
}

// ?interval=<ms> re-checks on a fixed timer (for previews). Default is the minute boundary.
function getConfiguredInterval() {
    const rawInterval = Number(new URLSearchParams(window.location.search).get('interval'));

    if (Number.isFinite(rawInterval) && rawInterval >= 250) {
        return rawInterval;
    }

    return null;
}
