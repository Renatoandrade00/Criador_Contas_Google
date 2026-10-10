import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

export class ExportService {
    constructor(outputDir = './output') {
        this.outputDir = path.resolve(outputDir);
        this.txtFilePath = path.join(this.outputDir, 'contas_criadas.txt');
        this.mdFilePath = path.join(this.outputDir, 'contas_criadas.md');
        this.jsonFilePath = path.join(this.outputDir, 'contas_detalhadas.json');
        this.isInitialized = false;
        this.writeQueue = Promise.resolve();
    }

    /**
     * Garante a criação do diretório de saída e cabeçalhos
     */
    async init() {
        if (this.isInitialized) return;
        try {
            await fs.mkdir(this.outputDir, { recursive: true });

            // Cria cabeçalho no .md se ainda não existir
            try {
                await fs.access(this.mdFilePath);
            } catch {
                const header = `# Relatório de Contas Google Criadas\n\n| Data / Hora | Email | Senha | Recuperação / Telefone | Proxy |\n|---|---|---|---|---|\n`;
                await fs.writeFile(this.mdFilePath, header, 'utf-8');
            }

            this.isInitialized = true;
        } catch (error) {
            logger.error('Erro ao inicializar ExportService', { error: error.message });
        }
    }

    /**
     * Gravação atômica e incremental (com fila/mutex em memória para prevenir race condition)
     * Formato: email|senha|recovery
     */
    async saveAccount(accountData) {
        await this.init();

        const email = accountData.email || '';
        const password = accountData.password || '';
        const recovery = accountData.recovery || accountData.phone || 'none';
        const timestamp = new Date().toLocaleString('pt-BR');
        const proxy = accountData.proxyUsed ? `${accountData.proxyUsed.host}:${accountData.proxyUsed.port}` : 'Direto';

        // Linha no formato solicitado pelo PRD
        const txtLine = `${email}|${password}|${recovery}\n`;
        const mdLine = `| ${timestamp} | \`${email}\` | \`${password}\` | ${recovery} | ${proxy} |\n`;

        // Executar gravação na fila sequencial
        this.writeQueue = this.writeQueue.then(async () => {
            try {
                // 1. Append no arquivo TXT
                await fs.appendFile(this.txtFilePath, txtLine, 'utf-8');

                // 2. Append no arquivo Markdown
                await fs.appendFile(this.mdFilePath, mdLine, 'utf-8');

                // 3. Atualizar JSON detalhado
                let currentRecords = [];
                try {
                    const content = await fs.readFile(this.jsonFilePath, 'utf-8');
                    currentRecords = JSON.parse(content);
                } catch {
                    currentRecords = [];
                }

                currentRecords.push({
                    id: accountData.id || Date.now(),
                    email,
                    password,
                    recovery,
                    phone: accountData.phone || null,
                    proxyUsed: proxy,
                    createdAt: new Date().toISOString()
                });

                await fs.writeFile(this.jsonFilePath, JSON.stringify(currentRecords, null, 2), 'utf-8');
                logger.info(`Credencial salva com sucesso em arquivo: ${email}`);
            } catch (err) {
                logger.error('Falha ao gravar credencial no arquivo', { error: err.message, email });
            }
        });

        return this.writeQueue;
    }

    getTxtPath() {
        return this.txtFilePath;
    }

    getMdPath() {
        return this.mdFilePath;
    }

    getJsonPath() {
        return this.jsonFilePath;
    }
}

export default new ExportService();
