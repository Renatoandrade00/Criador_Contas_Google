import axios from 'axios';
import BaseSmsProvider from './base-provider.js';
import logger from '../../utils/logger.js';
import { sleep } from '../../utils/helpers.js';

export class SmsPoolProvider extends BaseSmsProvider {
    constructor(apiKey, country = '1') {
        super(apiKey, country);
        this.baseUrl = 'https://api.smspool.net';
    }

    async getNumber() {
        try {
            logger.info(`SMSPool: Solicitando número Non-VoIP para Google (País: ${this.country})...`);
            
            // service = 'google' ou '1' (Google/Gmail no SMSPool)
            const response = await axios.get(`${this.baseUrl}/purchase/sms`, {
                params: {
                    key: this.apiKey,
                    country: this.country || '1', // 1 = US por padrão no SMSPool
                    service: 'google'
                },
                timeout: 15000
            });

            const data = response.data;
            if (data && (data.success === 1 || data.order_id)) {
                const phone = String(data.number || data.phonenumber).replace(/\D/g, '');
                const id = String(data.order_id);
                logger.info(`SMSPool: Número obtido com sucesso: +${phone} (Order: ${id})`);
                return { id, phone };
            }

            if (data && data.message) {
                throw new Error(`SMSPool erro: ${data.message}`);
            }

            throw new Error(`SMSPool resposta desconhecida: ${JSON.stringify(data)}`);
        } catch (error) {
            const msg = error.response?.data?.message || error.message;
            logger.error('SMSPool: Falha ao solicitar número', { error: msg });
            throw new Error(`SMSPool: ${msg}`);
        }
    }

    async waitForCode(activationId, timeoutSeconds = 120) {
        logger.info(`SMSPool: Aguardando SMS para o pedido ${activationId} (${timeoutSeconds}s)...`);
        const startTime = Date.now();
        const timeoutMs = timeoutSeconds * 1000;

        while (Date.now() - startTime < timeoutMs) {
            try {
                const response = await axios.get(`${this.baseUrl}/sms/check`, {
                    params: {
                        key: this.apiKey,
                        orderid: activationId
                    },
                    timeout: 10000
                });

                const data = response.data;
                // status: 1 = waiting, 3 = completed (SMS received), 2 = expired/cancelled
                if (data && data.status === 3 && data.sms) {
                    const code = String(data.sms).match(/\d{4,6}/)?.[0] || String(data.sms).trim();
                    logger.info(`SMSPool: Código SMS recebido: ${code}`);
                    return { code };
                }

                if (data && data.status === 2) {
                    throw new Error('SMSPool: Pedido expirou ou foi cancelado');
                }

                await sleep(4000);
            } catch (err) {
                if (err.message.includes('expirou') || err.message.includes('cancelado')) throw err;
                logger.debug('SMSPool: Verificando novamente...', { error: err.message });
                await sleep(4000);
            }
        }

        await this.cancelNumber(activationId).catch(() => {});
        throw new Error(`SMSPool: Timeout de ${timeoutSeconds}s esgotado aguardando código`);
    }

    async cancelNumber(activationId) {
        try {
            logger.info(`SMSPool: Cancelando pedido ${activationId}`);
            await axios.get(`${this.baseUrl}/sms/cancel`, {
                params: {
                    key: this.apiKey,
                    orderid: activationId
                },
                timeout: 10000
            });
        } catch (err) {
            logger.warn('SMSPool: Falha ao cancelar pedido', { error: err.message });
        }
    }

    async finishActivation(activationId) {
        // SMSPool encerra automaticamente quando o SMS é entregue com status 3
        logger.info(`SMSPool: Pedido ${activationId} concluído com sucesso`);
    }
}

export default SmsPoolProvider;
