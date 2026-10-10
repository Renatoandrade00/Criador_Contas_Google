import axios from 'axios';
import logger from '../utils/logger.js';

export class ProxyManager {
    constructor(proxyList = []) {
        this.proxies = [];
        this.currentIndex = 0;
        this.failedProxies = new Set();
        this.loadProxies(proxyList);
    }

    /**
     * Carrega e normaliza lista de proxies
     */
    loadProxies(list) {
        this.proxies = [];
        for (const item of list) {
            const trimmed = item.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const parsed = this.parseProxy(trimmed);
            if (parsed) {
                this.proxies.push(parsed);
            }
        }
        logger.info(`ProxyManager: ${this.proxies.length} proxies carregados`);
    }

    /**
     * Faz parse de strings nos formatos:
     * - ip:port
     * - ip:port:user:pass
     * - user:pass@ip:port
     * - http://...
     */
    parseProxy(proxyStr) {
        try {
            let clean = proxyStr.replace(/^https?:\/\//i, '');
            let host, port, username, password;

            if (clean.includes('@')) {
                const [auth, server] = clean.split('@');
                [username, password] = auth.split(':');
                [host, port] = server.split(':');
            } else {
                const parts = clean.split(':');
                if (parts.length === 2) {
                    [host, port] = parts;
                } else if (parts.length === 4) {
                    [host, port, username, password] = parts;
                } else {
                    return null;
                }
            }

            return {
                raw: proxyStr,
                host: host.trim(),
                port: parseInt(port.trim(), 10),
                username: username ? username.trim() : null,
                password: password ? password.trim() : null,
                serverUrl: `http://${host.trim()}:${port.trim()}`
            };
        } catch (err) {
            logger.warn(`Falha ao analisar proxy: ${proxyStr}`, { error: err.message });
            return null;
        }
    }

    /**
     * Retorna o próximo proxy disponível (Round-robin)
     */
    getNextProxy() {
        if (this.proxies.length === 0) return null;

        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    /**
     * Retorna quantidade de proxies carregados
     */
    getCount() {
        return this.proxies.length;
    }

    /**
     * Testa latência e conectividade de um proxy
     */
    async testProxy(proxy) {
        const start = Date.now();
        try {
            const config = {
                timeout: 8000,
                proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    auth: proxy.username ? { username: proxy.username, password: proxy.password } : undefined
                }
            };
            const response = await axios.get('https://api.ipify.org?format=json', config);
            const latency = Date.now() - start;
            return {
                alive: true,
                ip: response.data.ip,
                latencyMs: latency
            };
        } catch (error) {
            return {
                alive: false,
                error: error.message,
                latencyMs: Date.now() - start
            };
        }
    }
}

export default ProxyManager;
