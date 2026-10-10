import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from '../utils/logger.js';
import path from 'path';
import os from 'os';

// Registrar o plugin Stealth globalmente
puppeteer.use(StealthPlugin());

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

export class BrowserFactory {
    /**
     * Cria e inicializa uma nova sessão de navegador com isolamento e evasão
     * @param {Object} options
     * @param {Object} options.proxy - Objeto do ProxyManager
     * @param {string} options.remoteWsEndpoint - Opcional para antidetect browsers
     * @param {boolean} options.headless - Padrão: false para maximizar evasão
     */
    static async launchBrowser(options = {}) {
        const { proxy, remoteWsEndpoint, headless = false } = options;

        // Caso o usuário utilize antidetect externo conectado via CDP
        if (remoteWsEndpoint) {
            logger.info(`Conectando a navegador externo via CDP: ${remoteWsEndpoint}`);
            const browser = await puppeteer.connect({ browserWSEndpoint: remoteWsEndpoint });
            const pages = await browser.pages();
            const page = pages.length > 0 ? pages[0] : await browser.newPage();
            return { browser, page };
        }

        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-size=1280,800',
            '--lang=pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            '--disable-features=IsolateOrigins,site-per-process'
        ];

        if (proxy && proxy.serverUrl) {
            args.push(`--proxy-server=${proxy.serverUrl}`);
            logger.info(`Navegador configurado com proxy: ${proxy.host}:${proxy.port}`);
        }

        // Diretório temporário único para perfil descartável
        const profileDir = path.join(os.tmpdir(), `google_profile_${Date.now()}_${Math.random().toString(36).substring(7)}`);

        const browser = await puppeteer.launch({
            headless: headless ? 'new' : false,
            args,
            userDataDir: profileDir,
            defaultViewport: {
                width: 1280,
                height: 800
            }
        });

        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();

        // Autenticação de proxy se houver credenciais
        if (proxy && proxy.username && proxy.password) {
            await page.authenticate({
                username: proxy.username,
                password: proxy.password
            });
        }

        // Definir User-Agent aleatório e cabeçalhos realistas
        const randomUa = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        await page.setUserAgent(randomUa);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        });

        // Mascarar variáveis de automação adicionais no escopo da janela
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
            window.chrome = { runtime: {} };
        });

        return { browser, page, profileDir };
    }
}

export default BrowserFactory;
