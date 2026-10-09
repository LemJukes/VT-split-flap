// Board text layout: no DOM, no timers.
// A classic script (not a module) so the page opens straight from file:// with no build step.
(function (global) {
    const BLANK_CHARACTER = ' ';

    function normalizeText(text) {
        return text
            .toUpperCase()
            .replace(/[^A-Z\s]/g, BLANK_CHARACTER)
            .replace(/\s+/g, ' ')
            .trim();
    }

    function chunkWord(word, size) {
        const chunks = [];

        for (let index = 0; index < word.length; index += size) {
            chunks.push(word.slice(index, index + size));
        }

        return chunks;
    }

    // Greedy word wrap. Returns every row, unpadded, however many it takes.
    function wrapWords(text, columnCount) {
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
                rows.push(currentRow);
            }

            if (word.length <= columnCount) {
                currentRow = word;
                return;
            }

            const chunks = chunkWord(word, columnCount);
            rows.push(...chunks.slice(0, -1));
            currentRow = chunks[chunks.length - 1];
        });

        if (currentRow) {
            rows.push(currentRow);
        }

        return rows;
    }

    // Exactly rowCount rows of columnCount characters: padded, or truncated with a warning.
    function splitIntoRows(text, columnCount, rowCount) {
        const rows = wrapWords(text, columnCount).map((row) => row.padEnd(columnCount, BLANK_CHARACTER));

        if (rows.length > rowCount) {
            console.warn('Display text exceeds configured board height; truncating overflow.', text);
        }

        while (rows.length < rowCount) {
            rows.push(BLANK_CHARACTER.repeat(columnCount));
        }

        return rows.slice(0, rowCount);
    }

    function splitDisplay(display, columnCount) {
        const rows = [];

        for (let index = 0; index < display.length; index += columnCount) {
            rows.push(display.slice(index, index + columnCount));
        }

        return rows;
    }

    // Rows the board needs so no time phrase at `level` is ever truncated:
    // the worst case over all 1440 minutes, wrapped at columnCount.
    function rowsForLevel(format, level, columnCount) {
        const date = new Date(2026, 0, 1);
        let rows = 0;

        for (let minute = 0; minute < 1440; minute += 1) {
            date.setHours(Math.floor(minute / 60), minute % 60);
            const phrase = format(date, { level, case: 'upper', charset: 'alpha' });
            rows = Math.max(rows, wrapWords(phrase, columnCount).length);
        }

        return rows;
    }

    global.SplitFlapLayout = {
        BLANK_CHARACTER,
        normalizeText,
        wrapWords,
        splitIntoRows,
        splitDisplay,
        rowsForLevel
    };
})(globalThis);
