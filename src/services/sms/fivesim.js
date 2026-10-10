import axios from 'axios';
import BaseSmsProvider from './base-provider.js';
import logger from '../../utils/logger.js';
import { sleep } from '../../utils/helpers.js';

export class FiveSimProvider extends BaseSmsProvider {
    constructor(apiKey, country = 'england') {
        super(apiKey, country);
        this.baseUrl = 'https://5sim.net/v1/user';
        this.headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
        };
    }

    async getNumber() {
        try {
            logger.info(`5SIM: Solicitando número (País: ${this.country})...`);
            const url = `${this.baseUrl}/buy/activation/${this.country}/any/google`;
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 15000
            });

            const data = response.data;
            if (data && data.phone && data.id) {
                logger.info(`5SIM: Número obtido: ${data.phone} (ID: ${data.id})`);
                return {
                    id: String(data.id),
                    phone: String(data.phone).replace(/\+/g, '')
                };
            }

            throw new Error('5SIM: Resposta inválida na compra do número');
        } catch (error) {
            const msg = error.response?.data || error.message;
            logger.error('5SIM: Falha ao solicitar número', { error: msg });
            throw new Error(`5SIM erro: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        }
    }

    async waitForCode(activationId, timeoutSeconds = 120) {
        logger.info(`5SIM: Aguardando SMS ID ${activationId} (${timeoutSeconds}s)...`);
        const startTime = Date.now();
        const timeoutMs = timeoutSeconds * 1000;
        const checkUrl = `${this.baseUrl}/check/${activationId}`;

        while (Date.now() - startTime < timeoutMs) {
            try {
                const response = await axios.get(checkUrl, {
                    headers: this.headers,
                    timeout: 10000
                });

                const data = response.data;
                if (data && data.sms && data.sms.length > 0) {
                    const smsItem = data.sms[0];
                    const code = smsItem.code || smsItem.text.match(/\d{4,6}/)?.[0];
                    if (code) {
                        logger.info(`5SIM: Código recebido: ${code}`);
                        return { code: String(code) };
                    }
                }

                if (data.status === 'CANCELED' || data.status === 'TIMEOUT') {
                    throw new Error(`5SIM: Ativação com status ${data.status}`);
                }

                await sleep(4000);
            } catch (err) {
                if (err.message.includes('CANCELED')) throw err;
                logger.debug('5SIM: Tentando novamente...', { error: err.message });
                await sleep(4000);
            }
        }

        await this.cancelNumber(activationId).catch(() => {});
        throw new Error(`5SIM: Timeout de ${timeoutSeconds}s esgotado aguardando código`);
    }

    async cancelNumber(activationId) {
        try {
            logger.info(`5SIM: Cancelando pedido ID ${activationId}`);
            const cancelUrl = `${this.baseUrl}/cancel/${activationId}`;
            await axios.get(cancelUrl, {
                headers: this.headers,
                timeout: 10000
            });
        } catch (err) {
            logger.warn('5SIM: Falha ao cancelar pedido', { error: err.message });
        }
    }

    async finishActivation(activationId) {
        try {
            const finishUrl = `${this.baseUrl}/finish/${activationId}`;
            await axios.get(finishUrl, {
                headers: this.headers,
                timeout: 10000
            });
            logger.info(`5SIM: Pedido ID ${activationId} finalizado com sucesso`);
        } catch (err) {
            logger.warn('5SIM: Falha ao finalizar pedido', { error: err.message });
        }
    }
}

export default FiveSimProvider;
