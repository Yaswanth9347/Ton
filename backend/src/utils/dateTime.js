export const IST_TIMEZONE = 'Asia/Kolkata';
export const IST_LOCALE = 'en-IN';

const WEEKDAY_INDEX = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

const pad = (value) => String(value).padStart(2, '0');

const getParts = (value = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });

    return formatter.formatToParts(value).reduce((acc, part) => {
        if (part.type !== 'literal') {
            acc[part.type] = part.value;
        }
        return acc;
    }, {});
};

const ensureSqlSeconds = (value) => {
    if (!value) return value;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return `${value}:00`;
    return value;
};

export const getCurrentISTDate = () => {
    const { year, month, day } = getParts();
    return `${year}-${month}-${day}`;
};

export const getCurrentISTDateTime = () => {
    const { year, month, day, hour, minute, second } = getParts();
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

export const getCurrentISTMonthYear = () => {
    const { month, year } = getParts();
    return { month: Number(month), year: Number(year) };
};

export const getISTDateString = (value) => {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const { year, month, day } = getParts(value instanceof Date ? value : new Date(value));
    return `${year}-${month}-${day}`;
};

export const getISTMonthBounds = (month, year) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    return {
        startDate: `${year}-${pad(month)}-01`,
        endDate: `${year}-${pad(month)}-${pad(daysInMonth)}`,
        daysInMonth,
    };
};

export const getISTDateDaysAgo = (days) => {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return getISTDateString(date);
};

export const getISTWeekdayIndex = (value) => {
    const input = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T00:00:00+05:30`)
        : value instanceof Date
            ? value
            : new Date(value);

    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: IST_TIMEZONE,
        weekday: 'short',
    }).format(input);

    return WEEKDAY_INDEX[weekday] ?? 0;
};

export const isPastISTDate = (dateString) => {
    if (!dateString) return false;
    return dateString < getCurrentISTDate();
};

export const toDatabaseTimestamp = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
        const { year, month, day, hour, minute, second } = getParts(value);
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
            return ensureSqlSeconds(value.replace('T', ' '));
        }
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) {
            return ensureSqlSeconds(value);
        }
    }

    return getCurrentISTDateTime();
};