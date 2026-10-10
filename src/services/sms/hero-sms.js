import { SmsActivateProvider } from './sms-activate.js';

/**
 * Hero SMS Provider
 * Sucessor oficial e 100% compatível com a API clássica do SMS-Activate
 * Endpoint: https://hero-sms.com/stubs/handler_api.php
 */
export class HeroSmsProvider extends SmsActivateProvider {
    constructor(apiKey, country = '0') {
        super(apiKey, country);
        this.baseUrl = 'https://hero-sms.com/stubs/handler_api.php';
    }
}

export default HeroSmsProvider;
