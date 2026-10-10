import { AccountWorker } from './worker.js';
import { ProxyManager } from '../services/proxy-manager.js';
import { createSmsProvider } from '../services/sms/sms-factory.js';
import logger from '../utils/logger.js';
import { sleep } from '../utils/helpers.js';

export class QueueManager {
    constructor() {
        this.status = 'IDLE'; // IDLE, RUNNING, PAUSED, STOPPED
        this.config = null;
        this.proxyManager = null;
        this.smsProvider = null;

        // Métricas
        this.totalRequested = 0;
        this.createdCount = 0;
        this.failedCount = 0;
        this.activeWorkers = 0;

        this.listener = null;
        this.isProcessing = false;
    }

    setEventListener(fn) {
        this.listener = fn;
    }

    emitUpdate() {
        if (!this.listener) return;

        const totalProcessed = this.createdCount + this.failedCount;
        const progress = this.totalRequested > 0 ? Math.round((totalProcessed / this.totalRequested) * 100) : 0;
        const successRate = totalProcessed > 0 ? Math.round((this.createdCount / totalProcessed) * 100) : 0;

        this.listener('BATCH_STATUS', {
            status: this.status,
            totalRequested: this.totalRequested,
            created: this.createdCount,
            failed: this.failedCount,
            progress: Math.min(progress, 100),
            successRate,
            activeWorkers: this.activeWorkers
        });
    }

    /**
     * Inicia um novo lote de criação de contas
     */
    async startBatch(config) {
        if (this.status === 'RUNNING') {
            throw new Error('Já existe um lote em execução');
        }

        this.config = {
            totalAccounts: Math.max(1, parseInt(config.totalAccounts, 10) || 10),
            concurrency: Math.min(5, Math.max(1, parseInt(config.concurrency, 10) || 2)),
            executionMode: config.executionMode || 'CONSERVATIVE',
            smsProvider: config.smsProvider || process.env.SMS_PROVIDER || 'HERO_SMS',
            smsApiKey: config.smsApiKey || process.env.SMS_API_KEY || '',
            smsCountry: config.smsCountry || process.env.SMS_COUNTRY || '6',
            proxies: Array.isArray(config.proxies) ? config.proxies : (config.proxies ? config.proxies.split('\n') : [])
        };

        this.proxyManager = new ProxyManager(this.config.proxies);
        this.smsProvider = createSmsProvider(
            this.config.smsProvider,
            this.config.smsApiKey,
            this.config.smsCountry
        );

        this.totalRequested = this.config.totalAccounts;
        this.createdCount = 0;
        this.failedCount = 0;
        this.activeWorkers = 0;
        this.status = 'RUNNING';

        logger.info(`Lote iniciado: ${this.totalRequested} contas, concorrência: ${this.config.concurrency}, modo: ${this.config.executionMode}`);
        this.emitUpdate();

        // Disparar loop de processamento em background
        this.runQueueLoop();

        return { success: true, message: 'Lote iniciado com sucesso' };
    }

    /**
     * Loop do pool de trabalhadores com limite estrito de concorrência
     */
    async runQueueLoop() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        let processed = 0;

        while (this.status === 'RUNNING' || this.status === 'PAUSED') {
            // Se pausado, aguarda e continua verificando
            if (this.status === 'PAUSED') {
                await sleep(1000);
                continue;
            }

            // Verificar se o total solicitado já foi atingido
            if (this.createdCount + this.failedCount >= this.totalRequested) {
                logger.info('Lote concluído: todas as tarefas foram processadas');
                this.status = 'IDLE';
                this.emitUpdate();
                break;
            }

            // Se ainda temos slots de concorrência livres e tarefas restantes
            const remaining = this.totalRequested - (this.createdCount + this.failedCount + this.activeWorkers);

            if (this.activeWorkers < this.config.concurrency && remaining > 0) {
                this.activeWorkers++;
                processed++;
                const workerId = processed;
                this.emitUpdate();

                // Executar worker de forma assíncrona desacoplada do loop
                this.executeWorker(workerId);
            }

            await sleep(500);
        }

        this.isProcessing = false;
        if (this.status === 'STOPPED') {
            this.status = 'IDLE';
            this.emitUpdate();
        }
    }

    async executeWorker(workerId) {
        try {
            const worker = new AccountWorker(workerId, {
                proxyManager: this.proxyManager,
                smsProvider: this.smsProvider,
                executionMode: this.config.executionMode
            });

            const result = await worker.run();
            if (result.success) {
                this.createdCount++;
            } else {
                this.failedCount++;
            }
        } catch (err) {
            logger.error(`Erro crítico no worker #${workerId}`, { error: err.message });
            this.failedCount++;
        } finally {
            this.activeWorkers--;
            this.emitUpdate();
        }
    }

    pauseBatch() {
        if (this.status === 'RUNNING') {
            this.status = 'PAUSED';
            logger.info('Lote pausado pelo usuário');
            this.emitUpdate();
            return { success: true, message: 'Lote pausado' };
        }
        return { success: false, message: 'Nenhum lote ativo para pausar' };
    }

    resumeBatch() {
        if (this.status === 'PAUSED') {
            this.status = 'RUNNING';
            logger.info('Lote retomado pelo usuário');
            this.emitUpdate();
            return { success: true, message: 'Lote retomado' };
        }
        return { success: false, message: 'Nenhum lote pausado para retomar' };
    }

    stopBatch() {
        if (this.status === 'RUNNING' || this.status === 'PAUSED') {
            this.status = 'STOPPED';
            logger.info('Lote cancelado pelo usuário');
            this.emitUpdate();
            return { success: true, message: 'Lote interrompido' };
        }
        return { success: false, message: 'Nenhum lote ativo para interromper' };
    }

    getStatus() {
        const totalProcessed = this.createdCount + this.failedCount;
        const progress = this.totalRequested > 0 ? Math.round((totalProcessed / this.totalRequested) * 100) : 0;
        const successRate = totalProcessed > 0 ? Math.round((this.createdCount / totalProcessed) * 100) : 0;

        return {
            status: this.status,
            totalRequested: this.totalRequested,
            created: this.createdCount,
            failed: this.failedCount,
            progress: Math.min(progress, 100),
            successRate,
            activeWorkers: this.activeWorkers
        };
    }
}

export default new QueueManager();
