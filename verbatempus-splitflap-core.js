const hours = [
    "MIDNIGHT", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "NOON",
    "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN"
];

const minutes = [
    "ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE",
    "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVEN TEEN", "EIGHTEEN", "NINETEEN", "TWENTY",
    "TWENTY ONE", "TWENTY TWO", "TWENTY THREE", "TWENTY FOUR", "TWENTY FIVE", "TWENTY SIX", "TWENTY SEVEN",
    "TWENTY EIGHT", "TWENTY NINE", "THIRTY", "THIRTY ONE", "THIRTY TWO", "THIRTY THREE", "THIRTY FOUR",
    "THIRTY FIVE", "THIRTY SIX", "THIRTY SEVEN", "THIRTY EIGHT", "THIRTY NINE", "FORTY", "FORTY ONE",
    "FORTY TWO", "FORTY THREE", "FORTY FOUR", "FORTY FIVE", "FORTY SIX", "FORTY SEVEN", "FORTY EIGHT",
    "FORTY NINE", "FIFTY", "FIFTY ONE", "FIFTY TWO", "FIFTY THREE", "FIFTY FOUR", "FIFTY FIVE", "FIFTY SIX",
    "FIFTY SEVEN", "FIFTY EIGHT", "FIFTY NINE"
];

const specialMinutes = {
    15: "QUARTER",
    30: "HALF",
    45: "THREE QUARTERS"
};

const timeOfDay = {
    morning: "IN THE MORNING",
    afternoon: "IN THE AFTER NOON",
    evening: "IN THE EVENING"
};

function getTimeInWords() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    let hourWord = hours[hour % 24];
    let minuteWord = minutes[minute];
    let timePeriod = "";

    if (minute === 0) {
        if (hour >= 1 && hour <= 11) {
            timePeriod = timeOfDay.morning;
        } else if (hour >= 13 && hour <= 16) {
            timePeriod = timeOfDay.afternoon;
        } else if (hour >= 17 && hour <= 23) {
            timePeriod = timeOfDay.evening;
        }
        return `IT IS NOW ${hourWord} OCLOCK ${timePeriod}`.trim();
    }

    if (minute in specialMinutes) {
        minuteWord = specialMinutes[minute];
    }

    if (minute === 1) {
        return `IT IS NOW ONE MINUTE PAST ${hourWord}`;
    } else if (minute <= 30) {
        return `IT IS NOW ${minuteWord} MINUTES PAST ${hourWord}`;
    } else {
        const nextHourWord = hours[(hour + 1) % 24];
        const remainingMinutes = 60 - minute;
        minuteWord = minutes[remainingMinutes];
        if (remainingMinutes === 10) {
            return `IT IS NOW TEN TILL ${nextHourWord}`;
        } else if (remainingMinutes === 5) {
            return `IT IS NOW FIVE TILL ${nextHourWord}`;
        } else if (remainingMinutes === 1) {
            return `IT IS NOW ONE MINUTE TO ${nextHourWord}`;
        } else {
            return `IT IS NOW ${minuteWord} MINUTES TO ${nextHourWord}`;
        }
    }
}

function updateTime() {
    const timeInWords = getTimeInWords();
    console.log(timeInWords);
}

setInterval(updateTime, 60000);
updateTime();

export { getTimeInWords };