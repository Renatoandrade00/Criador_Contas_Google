/**
 * Sistema centralizado de logs com níveis e emissão de eventos
 */

let eventEmitter = null;

export function setLogEventEmitter(emitter) {
    eventEmitter = emitter;
}

function formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return {
        timestamp,
        level,
        message: `${message}${metaStr}`,
        rawMessage: message,
        meta
    };
}

export const logger = {
    info(msg, meta = {}) {
        const entry = formatMessage('INFO', msg, meta);
        console.log(`[\x1b[36m${entry.timestamp}\x1b[0m] [\x1b[32mINFO\x1b[0m] ${entry.message}`);
        if (eventEmitter) eventEmitter('LOG', entry);
    },
    warn(msg, meta = {}) {
        const entry = formatMessage('WARN', msg, meta);
        console.warn(`[\x1b[36m${entry.timestamp}\x1b[0m] [\x1b[33mWARN\x1b[0m] ${entry.message}`);
        if (eventEmitter) eventEmitter('LOG', entry);
    },
    error(msg, meta = {}) {
        const entry = formatMessage('ERROR', msg, meta);
        console.error(`[\x1b[36m${entry.timestamp}\x1b[0m] [\x1b[31mERROR\x1b[0m] ${entry.message}`);
        if (eventEmitter) eventEmitter('LOG', entry);
    },
    debug(msg, meta = {}) {
        const entry = formatMessage('DEBUG', msg, meta);
        if (process.env.DEBUG === 'true') {
            console.log(`[\x1b[36m${entry.timestamp}\x1b[0m] [\x1b[35mDEBUG\x1b[0m] ${entry.message}`);
        }
    }
};

export default logger;
