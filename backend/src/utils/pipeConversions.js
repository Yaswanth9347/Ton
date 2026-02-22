// Utility functions for pipe measurement conversions
// 1 pipe = 20 feet

const FEET_PER_PIPE = 20;

/**
 * Convert pipes to feet
 * @param {number} pipes - Number of pipes
 * @returns {number} - Equivalent feet
 */
export const pipesToFeet = (pipes) => {
    return pipes * FEET_PER_PIPE;
};

/**
 * Convert feet to pipes (decimal)
 * @param {number} feet - Number of feet
 * @returns {number} - Equivalent pipes (decimal)
 */
export const feetToPipes = (feet) => {
    return feet / FEET_PER_PIPE;
};

/**
 * Format quantity for display based on feet value
 * Returns format like "5 pipes 10 ft" or "5 pipes" or "10 ft"
 * @param {number} feet - Total feet
 * @returns {string} - Formatted display string
 */
export const formatQuantityDisplay = (feet) => {
    if (!feet || feet === 0) return '0 ft';

    const wholePipes = Math.floor(feet / FEET_PER_PIPE);
    const remainingFeet = feet % FEET_PER_PIPE;

    // If exactly divisible by 20, show only pipes
    if (remainingFeet === 0) {
        return wholePipes === 1 ? '1 pipe' : `${wholePipes} pipes`;
    }

    // If less than 20 feet, show only feet
    if (wholePipes === 0) {
        return `${remainingFeet} ft`;
    }

    // Mixed: show both pipes and feet
    const pipeText = wholePipes === 1 ? '1 pipe' : `${wholePipes} pipes`;
    return `${pipeText} ${remainingFeet} ft`;
};

/**
 * Convert quantity to feet based on unit type
 * @param {number} quantity - The quantity value
 * @param {string} unit - Either 'pipes' or 'feet'
 * @returns {number} - Quantity in feet
 */
export const convertToFeet = (quantity, unit) => {
    if (unit === 'feet') {
        return parseFloat(quantity);
    }
    return pipesToFeet(parseFloat(quantity));
};

/**
 * Parse and validate quantity input
 * @param {number|string} quantity - Input quantity
 * @param {string} unit - Either 'pipes' or 'feet'
 * @returns {{valid: boolean, feet: number, error: string|null}}
 */
export const validateQuantity = (quantity, unit) => {
    const num = parseFloat(quantity);

    if (isNaN(num) || num <= 0) {
        return {
            valid: false,
            feet: 0,
            error: 'Quantity must be a positive number'
        };
    }

    if (unit !== 'pipes' && unit !== 'feet') {
        return {
            valid: false,
            feet: 0,
            error: 'Unit must be either "pipes" or "feet"'
        };
    }

    const feet = convertToFeet(num, unit);

    return {
        valid: true,
        feet: feet,
        error: null
    };
};

export default {
    pipesToFeet,
    feetToPipes,
    formatQuantityDisplay,
    convertToFeet,
    validateQuantity,
    FEET_PER_PIPE
};
