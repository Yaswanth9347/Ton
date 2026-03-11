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

export const formatDateInIST = (value, options = {}) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat(IST_LOCALE, {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options,
    }).format(new Date(value));
};

export const formatTimeInIST = (value, options = {}) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat(IST_LOCALE, {
        timeZone: IST_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        ...options,
    }).format(new Date(value));
};

export const formatDateTimeInIST = (value, options = {}) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat(IST_LOCALE, {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        ...options,
    }).format(new Date(value));
};

export const getCurrentISTDate = () => {
    const { year, month, day } = getParts();
    return `${year}-${month}-${day}`;
};

export const getCurrentISTMonthYear = () => {
    const { month, year } = getParts();
    return { month: Number(month), year: Number(year) };
};

export const getDateDaysAgoIST = (days) => {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { year, month, day } = getParts(date);
    return `${year}-${month}-${day}`;
};

export const getMonthName = (month, format = 'long') => {
    return new Intl.DateTimeFormat(IST_LOCALE, {
        timeZone: IST_TIMEZONE,
        month: format,
    }).format(new Date(Date.UTC(2024, month - 1, 1, 12, 0, 0)));
};

export const getWeekdayIndexInIST = (value) => {
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

export const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

export const getCurrentISTDay = () => Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
}).format(new Date()));

export const formatForDateTimeLocalInput = (value) => {
    if (!value) return '';
    const { year, month, day, hour, minute } = getParts(new Date(value));
    return `${year}-${month}-${day}T${hour}:${minute}`;
};

export const toISTSqlTimestamp = (value) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
        return `${value.replace('T', ' ')}:00`;
    }
    return value;
};