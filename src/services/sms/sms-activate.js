import axios from 'axios';
import BaseSmsProvider from './base-provider.js';
import logger from '../../utils/logger.js';
import { sleep } from '../../utils/helpers.js';

export class SmsActivateProvider extends BaseSmsProvider {
    constructor(apiKey, country = '0') {
        super(apiKey, country);
        this.baseUrl = 'https://api.sms-activate.org/stubs/handler_api.php';
    }

    async getNumber() {
        try {
            logger.info('SMS-Activate: Solicitando número para Google/Gmail...');
            const response = await axios.get(this.baseUrl, {
                params: {
                    api_key: this.apiKey,
                    action: 'getNumber',
                    service: 'go', // Google / YouTube
                    country: this.country
                },
                timeout: 15000
            });

            const data = String(response.data);
            if (data.startsWith('ACCESS_NUMBER')) {
                const [, id, phone] = data.split(':');
                logger.info(`SMS-Activate: Número obtido com sucesso: +${phone} (ID: ${id})`);
                return { id, phone };
            }

            if (data === 'NO_NUMBERS') {
                throw new Error('SMS-Activate: Sem números disponíveis no momento para este país');
            }
            if (data === 'NO_BALANCE') {
                throw new Error('SMS-Activate: Saldo insuficiente');
            }
            if (data === 'BAD_KEY') {
                throw new Error('SMS-Activate: Chave de API inválida');
            }

            throw new Error(`SMS-Activate erro: ${data}`);
        } catch (error) {
            logger.error('SMS-Activate: Falha ao solicitar número', { error: error.message });
            throw error;
        }
    }

    async waitForCode(activationId, timeoutSeconds = 120) {
        logger.info(`SMS-Activate: Aguardando código SMS para o ID ${activationId} (timeout: ${timeoutSeconds}s)...`);
        const startTime = Date.now();
        const timeoutMs = timeoutSeconds * 1000;

        while (Date.now() - startTime < timeoutMs) {
            try {
                const response = await axios.get(this.baseUrl, {
                    params: {
                        api_key: this.apiKey,
                        action: 'getStatus',
                        id: activationId
                    },
                    timeout: 10000
                });

                const data = String(response.data);
                if (data.startsWith('STATUS_OK')) {
                    const code = data.split(':')[1].replace(/\D/g, '');
                    logger.info(`SMS-Activate: Código SMS recebido com sucesso: ${code}`);
                    return { code };
                }

                if (data === 'STATUS_CANCEL') {
                    throw new Error('SMS-Activate: Ativação foi cancelada pelo provedor');
                }

                // STATUS_WAIT_CODE -> aguarda 5s e repete
                await sleep(4000);
            } catch (err) {
                if (err.message.includes('cancelada')) throw err;
                logger.debug('SMS-Activate: Tentando verificar status novamente...', { error: err.message });
                await sleep(4000);
            }
        }

        // Se der timeout, cancelar o número
        await this.cancelNumber(activationId).catch(() => {});
        throw new Error(`SMS-Activate: Tempo limite de ${timeoutSeconds}s esgotado aguardando código`);
    }

    async cancelNumber(activationId) {
        try {
            logger.info(`SMS-Activate: Cancelando número ID ${activationId}`);
            await axios.get(this.baseUrl, {
                params: {
                    api_key: this.apiKey,
                    action: 'setStatus',
                    status: '8', // 8 = cancelar
                    id: activationId
                },
                timeout: 10000
            });
        } catch (err) {
            logger.warn('SMS-Activate: Falha ao cancelar número', { error: err.message });
        }
    }

    async finishActivation(activationId) {
        try {
            await axios.get(this.baseUrl, {
                params: {
                    api_key: this.apiKey,
                    action: 'setStatus',
                    status: '6', // 6 = finalizado com sucesso
                    id: activationId
                },
                timeout: 10000
            });
            logger.info(`SMS-Activate: Ativação concluída ID ${activationId}`);
        } catch (err) {
            logger.warn('SMS-Activate: Falha ao finalizar ativação', { error: err.message });
        }
    }
}

export default SmsActivateProvider;
