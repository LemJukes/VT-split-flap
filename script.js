import { getTimeInWords } from './verbatempus-splitflap-core.js';

const BOARD = {
    rows: 6,
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
const BLANK_CHARACTER = ' ';
const CHARACTER_SET = `${BLANK_CHARACTER}ABCDEFGHIJKLMNOPQRSTUVWXYZ`;
const queryParams = new URLSearchParams(window.location.search);
const previewPhrase = normalizeText(queryParams.get('phrase') || '');
const cycle = createCycleMap(CHARACTER_SET);

let currentRows = splitIntoRows(INITIAL_MESSAGE);
let currentDisplay = currentRows.join('');
let isAnimating = false;
let queuedDisplay = null;

const container = d3.select('.container');
applyBoardVariables(container, BOARD);

const rowData = createBoardState(currentRows);
const rowSelection = container
    .selectAll('.row')
    .data(rowData)
    .enter()
    .append('div')
    .attr('class', 'row');

const flaps = rowSelection
    .selectAll('.flap')
    .data((row) => row)
    .enter()
    .append('div')
    .attr('class', 'flap')
    .attr('data-row', (cell) => cell.rowIndex)
    .attr('data-column', (cell) => cell.columnIndex);

['next', 'prev', 'back', 'front'].forEach((segment) => {
    if (segment === 'front') {
        flaps.append('div').attr('class', 'divider');
    }

    flaps
        .append('div')
        .attr('class', `half ${segment}`)
        .append('span')
        .text((cell) => cell.letter);
});

window.setTimeout(() => {
    updateDisplay();
    window.setInterval(updateDisplay, BOARD.timings.updateInterval);
}, BOARD.timings.bootDelay);

function updateDisplay() {
    const nextRows = splitIntoRows(getDisplayText());
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

    flaps.each(function schedule(cell) {
        const toLetter = targetDisplay[cell.index] || BLANK_CHARACTER;

        if (cell.letter === toLetter) {
            return;
        }

        transitions.push(scheduleFlip(d3.select(this), cell, toLetter));
    });

    Promise.all(transitions).then(() => {
        currentDisplay = targetDisplay;
        currentRows = splitDisplay(currentDisplay);
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

    const prevFlaps = flap.selectAll('.prev span, .front span');
    const nextFlaps = flap.selectAll('.back span, .next span');
    const frontFace = flap.select('.front');
    let next = getNextCharacter(cell.letter);
    let fastModeEnabled = false;

    frontFace.on('animationiteration.flip', null);
    frontFace.on('animationiteration.flip', () => {
        if (next === toLetter) {
            cell.letter = toLetter;
            frontFace.on('animationiteration.flip', null);

            flap
                .classed('animated fast', false)
                .selectAll('span')
                .text(toLetter);

            window.setTimeout(resolve, 60);
            return;
        }

        if (!fastModeEnabled) {
            fastModeEnabled = true;
            flap.classed('fast', true);
        }

        prevFlaps.text(next);
        cell.letter = next;
        next = getNextCharacter(next);

        window.setTimeout(() => {
            nextFlaps.text(next);
        }, 0);
    });

    flap.classed('animated', true);
    nextFlaps.text(next);
}

function getDisplayText() {
    if (previewPhrase) {
        return previewPhrase;
    }

    return getTimeInWords();
}

function splitIntoRows(text, columnCount = BOARD.columns, rowCount = BOARD.rows) {
    const words = normalizeText(text).split(' ').filter(Boolean);
    const rows = [];
    let currentRow = '';

    words.forEach((word) => {
        const candidate = currentRow ? `${currentRow} ${word}` : word;

        if (candidate.length <= columnCount) {
            currentRow = candidate;
            return;
        }

        if (currentRow) {
            rows.push(currentRow.padEnd(columnCount, BLANK_CHARACTER));
        }

        if (word.length <= columnCount) {
            currentRow = word;
            return;
        }

        const chunks = chunkWord(word, columnCount);
        rows.push(...chunks.slice(0, -1).map((chunk) => chunk.padEnd(columnCount, BLANK_CHARACTER)));
        currentRow = chunks[chunks.length - 1];
    });

    if (currentRow) {
        rows.push(currentRow.padEnd(columnCount, BLANK_CHARACTER));
    }

    if (rows.length > rowCount) {
        console.warn('Display text exceeds configured board height; truncating overflow.', text);
    }

    while (rows.length < rowCount) {
        rows.push(BLANK_CHARACTER.repeat(columnCount));
    }

    return rows.slice(0, rowCount);
}

function splitDisplay(display, columnCount = BOARD.columns) {
    const rows = [];

    for (let index = 0; index < display.length; index += columnCount) {
        rows.push(display.slice(index, index + columnCount));
    }

    return rows;
}

function createBoardState(rows) {
    return rows.map((row, rowIndex) => row.split('').map((letter, columnIndex) => ({
        rowIndex,
        columnIndex,
        index: rowIndex * BOARD.columns + columnIndex,
        letter
    })));
}

function applyBoardVariables(selection, board) {
    selection
        .style('--board-columns', board.columns)
        .style('--board-rows', board.rows)
        .style('--cell-width', `${board.cellWidth}px`)
        .style('--cell-height', `${board.cellHeight}px`)
        .style('--flap-width', `${board.flapWidth}px`)
        .style('--flap-height', `${board.flapHeight}px`)
        .style('--half-height', `${board.halfHeight}px`)
        .style('--board-padding', `${board.boardPadding}px`)
        .style('--board-perspective', `${board.perspective}px`)
        .style('--display-font-size', `${board.fontSize}px`)
        .style('--front-letter-offset', `${board.frontOffset}px`)
        .style('--back-letter-offset', `${board.backOffset}px`)
        .style('--wave-row-stagger', `${board.timings.rowStagger}ms`)
        .style('--wave-column-stagger', `${board.timings.columnStagger}ms`);
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

function chunkWord(word, size) {
    const chunks = [];

    for (let index = 0; index < word.length; index += size) {
        chunks.push(word.slice(index, index + size));
    }

    return chunks;
}

function normalizeText(text) {
    return text
        .toUpperCase()
        .replace(/[^A-Z\s]/g, BLANK_CHARACTER)
        .replace(/\s+/g, ' ')
        .trim();
}

function getConfiguredInterval() {
    const rawInterval = Number(new URLSearchParams(window.location.search).get('interval'));

    if (Number.isFinite(rawInterval) && rawInterval >= 250) {
        return rawInterval;
    }

    return 60000;
}
