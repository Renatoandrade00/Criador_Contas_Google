import { BrowserFactory } from '../automation/browser-factory.js';
import { HumanBehaviorEngine } from '../automation/human-behavior.js';
import { FlowManager } from '../automation/flow-manager.js';
import { generateIdentity } from '../services/name-generator.js';
import exportService from '../services/export-service.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

export class AccountWorker {
    constructor(workerId, options = {}) {
        this.workerId = workerId;
        this.proxyManager = options.proxyManager;
        this.smsProvider = options.smsProvider;
        this.executionMode = options.executionMode || 'CONSERVATIVE';
    }

    /**
     * Executa a rotina de criação de uma conta com isolamento total de recursos
     */
    async run() {
        let browser = null;
        let profileDir = null;
        const proxy = this.proxyManager ? this.proxyManager.getNextProxy() : null;
        const identity = generateIdentity();
        const humanEngine = new HumanBehaviorEngine(this.executionMode);

        logger.info(`[Worker #${this.workerId}] Iniciando processo para: ${identity.fullName}`);

        try {
            // 1. Lançar navegador com evasão e proxy
            const session = await BrowserFactory.launchBrowser({
                proxy,
                headless: false
            });
            browser = session.browser;
            profileDir = session.profileDir;

            // 2. Executar o fluxo automatizado do Google
            const flow = new FlowManager(session.page, identity, this.smsProvider, humanEngine);
            const result = await flow.execute();

            // 3. Persistir dados imediatamente no formato email|senha|recovery
            result.proxyUsed = proxy;
            await exportService.saveAccount(result);

            logger.info(`[Worker #${this.workerId}] Conta criada e exportada com sucesso: ${result.email}`);
            return {
                success: true,
                email: result.email,
                workerId: this.workerId
            };
        } catch (error) {
            logger.error(`[Worker #${this.workerId}] Falha na criação da conta`, {
                error: error.message,
                email: identity.email
            });
            return {
                success: false,
                email: identity.email,
                reason: error.message,
                workerId: this.workerId
            };
        } finally {
            // Garantir destruição segura do processo do navegador
            if (browser) {
                try {
                    await browser.close();
                } catch {
                    // Silencioso
                }
            }

            // Limpar diretório temporário do perfil para não lotar disco
            if (profileDir) {
                try {
                    await fs.rm(profileDir, { recursive: true, force: true });
                } catch {
                    // Silencioso
                }
            }
        }
    }
}

export default AccountWorker;
