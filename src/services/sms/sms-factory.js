import { SmsActivateProvider } from './sms-activate.js';
import { HeroSmsProvider } from './hero-sms.js';
import { FiveSimProvider } from './fivesim.js';
import { SmsPoolProvider } from './smspool.js';
import logger from '../../utils/logger.js';

export function createSmsProvider(providerType, apiKey, country) {
    const type = (providerType || 'HERO_SMS').toUpperCase();

    logger.info(`Inicializando provedor de SMS: ${type}`);
    switch (type) {
        case 'HERO_SMS':
        case 'HEROSMS':
            return new HeroSmsProvider(apiKey, country || '0');

        case 'SMSPOOL':
        case 'SMS_POOL':
            return new SmsPoolProvider(apiKey, country || '1');

        case 'FIVESIM':
        case '5SIM':
            return new FiveSimProvider(apiKey, country || 'england');

        case 'SMS_ACTIVATE':
            return new SmsActivateProvider(apiKey, country || '0');

        default:
            logger.warn(`Provedor de SMS ${type} não reconhecido, usando Hero SMS por padrão`);
            return new HeroSmsProvider(apiKey, country || '0');
    }
}

export default createSmsProvider;
