import { getTimeInWords } from './verbatempus-splitflap-core.js';

// Initial welcome message padded to 12x12 grid
let initialText = splitIntoRows("VERBA TEMPUS A CLOCK FULL OF WORDS");
let currentDisplay = initialText.join("");
let nextDisplay = "";

// Create letter cycle mapping
let cycle = {};
for (let i = 65; i < 90; i++) {
    cycle[String.fromCharCode(i)] = String.fromCharCode(i + 1);
}
cycle["Z"] = " ";
cycle[" "] = "A";

// Create 12x12 grid
let rows = d3.select(".container")
    .selectAll(".row")
    .data(initialText)
    .enter()
    .append("div")
    .attr("class", "row")
    .style("top", (d, i) => i * 72 + "px"); // Reduced spacing for more rows

let flaps = rows.selectAll("div")
    .data(row => row.split(""))
    .enter()
    .append("div")
    .attr("class", "flap")
    .style("left", (d, i) => i * 59 + "px"); // Adjusted spacing for more columns

["next", "prev", "back", "front"].forEach(d => {
    if (d === "front") {
        flaps.append("div")
            .attr("class", "divider");
    }
    flaps.append("div")
        .attr("class", "half " + d)
        .append("span")
        .text(letter => letter);
});

// Initial display then transition to time
setTimeout(() => {
    updateDisplay();
    setInterval(updateDisplay, 60000); // Update every minute
}, 3000);

function updateDisplay() {
    let timeWords = getTimeInWords();
    let rows = splitIntoRows(timeWords);
    let newDisplay = rows.join('');
    
    if (newDisplay === currentDisplay) return;
    
    nextDisplay = newDisplay;
    flip();
}

function flip() {
    d3.timeout(() => {
        let q = d3.queue();
        rows.each(function(row, rowIndex) {
            d3.select(this)
                .selectAll(".flap")
                .each(function(fromLetter, colIndex) {
                    let position = rowIndex * 8 + colIndex;
                    let toLetter = nextDisplay[position];
                    let flap = d3.select(this);
                    if (fromLetter !== toLetter) {
                        q.defer(flipLetter, flap.datum(toLetter), fromLetter, toLetter);
                    }
                });
        });
        q.awaitAll(function(err) {
            if (err) throw err;
            currentDisplay = nextDisplay;
        });
    }, 500);
}

function flipLetter(flap, fromLetter, toLetter, cb) {
    let current = fromLetter,
        next = cycle[fromLetter],
        prevFlaps = flap.selectAll(".prev span, .front span"),
        nextFlaps = flap.selectAll(".back span, .next span"),
        fast;

    flap.select(".front").on("animationiteration", function() {
        if (next === toLetter) {
            flap.classed("animated fast", false)
                .selectAll("span")
                .text(toLetter);
            return cb();
        }

        if (!fast) {
            fast = flap.classed("fast", true);
        }

        prevFlaps.text(next);
        current = next;
        next = cycle[next];

        setTimeout(function() {
            nextFlaps.text(next);
        }, 0);
    });

    flap.classed("animated", true);
    nextFlaps.text(next);
}

function splitIntoRows(text, rowLength = 8) {
    const words = text.trim().split(' ');
    const rows = [];
    let currentRow = '';
    
    for (let word of words) {
        // Check if adding this word would exceed row length
        if ((currentRow + ' ' + word).trim().length <= rowLength) {
            currentRow = (currentRow + ' ' + word).trim();
        } else {
            // Push current row and start new one
            rows.push(currentRow.padEnd(rowLength));
            currentRow = word;
        }
    }
    
    // Add final row
    if (currentRow) {
        rows.push(currentRow.padEnd(rowLength));
    }
    
    // Pad remaining rows to fill grid
    while (rows.length < 8) {
        rows.push(''.padEnd(rowLength));
    }
    
    return rows;
}
