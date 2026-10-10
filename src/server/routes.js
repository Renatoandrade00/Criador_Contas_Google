import express from 'express';
import axios from 'axios';
import queueManager from '../core/queue-manager.js';
import exportService from '../services/export-service.js';
import { ProxyManager } from '../services/proxy-manager.js';
import fs from 'fs/promises';

const router = express.Router();

/**
 * Iniciar lote de criação
 */
router.post('/batch/start', async (req, res) => {
    try {
        const config = req.body;
        const result = await queueManager.startBatch(config);
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * Pausar lote ativo
 */
router.post('/batch/pause', (req, res) => {
    const result = queueManager.pauseBatch();
    res.json(result);
});

/**
 * Retomar lote pausado
 */
router.post('/batch/resume', (req, res) => {
    const result = queueManager.resumeBatch();
    res.json(result);
});

/**
 * Cancelar lote ativo
 */
router.post('/batch/stop', (req, res) => {
    const result = queueManager.stopBatch();
    res.json(result);
});

/**
 * Obter status atual do lote
 */
router.get('/batch/status', (req, res) => {
    res.json(queueManager.getStatus());
});

/**
 * Download das credenciais criadas (.txt ou .md)
 */
router.get('/export/download', async (req, res) => {
    const format = req.query.format === 'md' ? 'md' : 'txt';
    const filePath = format === 'md' ? exportService.getMdPath() : exportService.getTxtPath();

    try {
        await fs.access(filePath);
        res.download(filePath, `contas_google_${Date.now()}.${format}`);
    } catch {
        res.status(404).json({ success: false, message: 'Nenhuma conta criada até o momento' });
    }
});

/**
 * Testar conectividade de um proxy individual
 */
router.post('/proxy/test', async (req, res) => {
    const { proxy } = req.body;
    if (!proxy) {
        return res.status(400).json({ success: false, message: 'Proxy não informado' });
    }

    const pm = new ProxyManager();
    const parsed = pm.parseProxy(proxy);
    if (!parsed) {
        return res.status(400).json({ success: false, message: 'Formato de proxy inválido' });
    }

    const testResult = await pm.testProxy(parsed);
    res.json(testResult);
});

/**
 * Obter configurações padrão do .env
 */
router.get('/config/defaults', (req, res) => {
    res.json({
        smsProvider: process.env.SMS_PROVIDER || 'HERO_SMS',
        smsApiKey: process.env.SMS_API_KEY || '',
        smsCountry: process.env.SMS_COUNTRY || '6'
    });
});

/**
 * Consultar saldo atual do provedor de SMS
 */
router.get('/sms/balance', async (req, res) => {
    try {
        const apiKey = req.query.apiKey || process.env.SMS_API_KEY;
        const provider = (req.query.provider || process.env.SMS_PROVIDER || 'HERO_SMS').toUpperCase();

        if (!apiKey) {
            return res.json({ success: false, balance: 'N/A' });
        }

        if (provider === 'HERO_SMS' || provider === 'HEROSMS' || provider === 'SMS_ACTIVATE') {
            const url = `https://hero-sms.com/stubs/handler_api.php?api_key=${apiKey}&action=getBalance`;
            const resp = await axios.get(url, { timeout: 8000 });
            const data = String(resp.data);
            if (data.startsWith('ACCESS_BALANCE:')) {
                const balance = data.split(':')[1];
                return res.json({ success: true, balance: `${balance} créditos` });
            }
        } else if (provider === 'SMSPOOL') {
            const url = `https://api.smspool.net/request/balance?key=${apiKey}`;
            const resp = await axios.get(url, { timeout: 8000 });
            if (resp.data && resp.data.balance !== undefined) {
                return res.json({ success: true, balance: `$${resp.data.balance} USD` });
            }
        }
        res.json({ success: true, balance: 'Ativo' });
    } catch (err) {
        res.json({ success: false, error: err.message, balance: 'Indisponível' });
    }
});

export default router;
