/**
 * Interface base para provedores de SMS virtuais
 */
export class BaseSmsProvider {
    constructor(apiKey, country = '0') {
        this.apiKey = apiKey;
        this.country = country;
    }

    /**
     * Solicita um número temporário para o serviço do Google/Gmail
     * @returns {Promise<{ id: string, phone: string }>}
     */
    async getNumber() {
        throw new Error('Método getNumber() não implementado');
    }

    /**
     * Aguarda o recebimento do código SMS
     * @param {string} activationId
     * @param {number} timeoutSeconds
     * @returns {Promise<{ code: string }>}
     */
    async waitForCode(activationId, timeoutSeconds = 120) {
        throw new Error('Método waitForCode() não implementado');
    }

    /**
     * Notifica cancelamento do número (ex: se o Google rejeitar)
     * @param {string} activationId
     */
    async cancelNumber(activationId) {
        throw new Error('Método cancelNumber() não implementado');
    }

    /**
     * Notifica conclusão com sucesso da ativação
     * @param {string} activationId
     */
    async finishActivation(activationId) {
        throw new Error('Método finishActivation() não implementado');
    }
}

export default BaseSmsProvider;
