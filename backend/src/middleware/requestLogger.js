
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const { method, url, body, query, params } = req;


    // Filter sensitive data from body
    const sanitize = (data) => {
        if (!data) return data;
        const sensitiveKeys = ['password', 'token', 'confirmPassword', 'newPassword', 'oldPassword'];
        const sanitized = { ...data };

        Object.keys(sanitized).forEach(key => {
            if (sensitiveKeys.includes(key)) {
                sanitized[key] = '***SENSITIVE***';
            } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
                sanitized[key] = sanitize(sanitized[key]);
            }
        });

        return sanitized;
    };

    const sanitizedBody = sanitize(body);

    // Initial Request Log
    console.log(`\x1b[36m[${timestamp}] \x1b[33m${method} \x1b[37m${url}\x1b[0m`);

    if (Object.keys(query).length > 0) {
        console.log(`\x1b[90m  Query: ${JSON.stringify(query)}\x1b[0m`);
    }

    if (Object.keys(params).length > 0) {
        console.log(`\x1b[90m  Params: ${JSON.stringify(params)}\x1b[0m`);
    }

    if (Object.keys(sanitizedBody).length > 0) {
        console.log(`\x1b[90m  Body: ${JSON.stringify(sanitizedBody)}\x1b[0m`);
    }

    // Capture Response
    const originalSend = res.send;
    res.send = function (content) {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;

        // Color coding for status
        let statusColor = '\x1b[32m'; // Green for 2xx
        if (statusCode >= 300) statusColor = '\x1b[36m'; // Cyan for 3xx
        if (statusCode >= 400) statusColor = '\x1b[33m'; // Yellow for 4xx
        if (statusCode >= 500) statusColor = '\x1b[31m'; // Red for 5xx

        console.log(`\x1b[36m[${timestamp}] \x1b[33m${method} \x1b[37m${url} ${statusColor}${statusCode} \x1b[35m${duration}ms\x1b[0m`);

        if (statusCode >= 400) {
            try {
                // Try to parse error response if it's JSON
                const responseBody = JSON.parse(content);
                console.log(`\x1b[31m  Error: ${responseBody.message || JSON.stringify(responseBody)}\x1b[0m`);
            } catch (e) {
                // If not JSON, just log a snippet
                console.log(`\x1b[31m  Error response: ${content.substring(0, 100)}...\x1b[0m`);
            }
        }

        originalSend.call(this, content);
    };

    next();
};

export default requestLogger;
