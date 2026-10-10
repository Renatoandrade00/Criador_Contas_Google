import { PageDetector, PAGE_TYPES } from './page-detector.js';
import logger from '../utils/logger.js';
import { sleep, randomInt } from '../utils/helpers.js';

export class FlowManager {
    constructor(page, identity, smsProvider, humanEngine) {
        this.page = page;
        this.identity = identity;
        this.smsProvider = smsProvider;
        this.humanEngine = humanEngine;
        this.activePhoneSession = null;
        this.confirmedEmail = identity.email;
    }

    /**
     * Executa o fluxo completo de criação de conta
     */
    async execute() {
        logger.info(`Iniciando cadastro do Google para ${this.identity.fullName} (${this.identity.email})...`);

        // 1. Navegar para a página de SignUp
        await this.page.goto('https://accounts.google.com/signup', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        await this.humanEngine.delay('pageLoad');

        let maxSteps = 25;
        let stepCount = 0;

        while (stepCount < maxSteps) {
            stepCount++;
            await sleep(1500);

            const pageState = await PageDetector.detectCurrentPage(this.page);
            logger.info(`Fluxo etapa ${stepCount}: Tela detectada -> [${pageState.type}]`);

            switch (pageState.type) {
                case PAGE_TYPES.NAME_STEP:
                    await this.handleNameStep();
                    break;

                case PAGE_TYPES.DOB_GENDER_STEP:
                    await this.handleDobGenderStep();
                    break;

                case PAGE_TYPES.CHOOSE_EMAIL_STEP:
                    await this.handleChooseEmailStep();
                    break;

                case PAGE_TYPES.CUSTOM_USERNAME_STEP:
                    await this.handleCustomUsernameStep();
                    break;

                case PAGE_TYPES.PASSWORD_STEP:
                    await this.handlePasswordStep();
                    break;

                case PAGE_TYPES.PHONE_STEP:
                    await this.handlePhoneStep();
                    break;

                case PAGE_TYPES.SMS_CODE_STEP:
                    await this.handleSmsCodeStep();
                    break;

                case PAGE_TYPES.RECOVERY_EMAIL_STEP:
                    await this.handleRecoveryStep();
                    break;

                case PAGE_TYPES.TERMS_STEP:
                    await this.handleTermsStep();
                    break;

                case PAGE_TYPES.COMPLETED:
                    logger.info(`Conta criada com sucesso! [${this.confirmedEmail}]`);
                    return {
                        success: true,
                        email: this.confirmedEmail,
                        password: this.identity.password,
                        phone: this.activePhoneSession?.phone || 'none',
                        recovery: 'none'
                    };

                default:
                    // Tentar clicar em avançar ou aguardar transição
                    logger.debug('Estado intermediário, tentando avançar...');
                    await PageDetector.clickNextButton(this.page, this.humanEngine);
                    await this.humanEngine.delay('action');
                    break;
            }
        }

        // Se chegou ao fim do loop, verificar se estamos em página pós-cadastro
        const finalUrl = this.page.url();
        if (finalUrl.includes('myaccount') || finalUrl.includes('mail.google')) {
            return {
                success: true,
                email: this.confirmedEmail,
                password: this.identity.password,
                phone: this.activePhoneSession?.phone || 'none',
                recovery: 'none'
            };
        }

        throw new Error(`Tempo limite do fluxo excedido após ${maxSteps} interações`);
    }

    async handleNameStep() {
        logger.info('Preenchendo Nome e Sobrenome...');
        const firstNameInput = await this.page.$('input[name="firstName"], #firstName');
        if (firstNameInput) {
            await this.humanEngine.humanType(this.page, firstNameInput, this.identity.firstName);
        }

        const lastNameInput = await this.page.$('input[name="lastName"], #lastName');
        if (lastNameInput) {
            await this.humanEngine.humanType(this.page, lastNameInput, this.identity.lastName);
        }

        await PageDetector.clickNextButton(this.page, this.humanEngine);
        await this.humanEngine.delay('pageLoad');
    }

    async handleDobGenderStep() {
        logger.info('Preenchendo Data de Nascimento e Gênero...');

        const monthIdx = parseInt(this.identity.birthMonth, 10); // 1 a 12
        const dayVal = String(this.identity.birthDay);
        const yearVal = String(this.identity.birthYear);
        const isFemale = this.identity.genderLabel === 'FEMALE';

        // 1. Mês: Abrir dropdown Material e clicar na opção correspondente
        try {
            const monthTrigger = await this.page.$('#month [role="combobox"], #month, div[aria-label*="Month" i], div[jsname="O1htCb"]');
            if (monthTrigger) {
                await this.humanEngine.humanClick(this.page, monthTrigger);
                await sleep(500);

                const targetMonthIdx = Math.max(0, monthIdx - 1); // 0-based
                const monthSelected = await this.page.evaluate((targetIdx) => {
                    const listbox = document.querySelector('ul[role="listbox"][aria-label*="Month" i], #month ul[role="listbox"]') || document.querySelector('ul[role="listbox"]');
                    if (listbox) {
                        const options = Array.from(listbox.querySelectorAll('li[role="option"]'));
                        if (options[targetIdx]) {
                            options[targetIdx].click();
                            return options[targetIdx].innerText;
                        }
                    }
                    return null;
                }, targetMonthIdx);

                if (monthSelected) {
                    logger.info(`Mês selecionado: ${monthSelected}`);
                } else {
                    // Fallback via teclado
                    for (let k = 0; k < monthIdx; k++) {
                        await this.page.keyboard.press('ArrowDown');
                        await sleep(50);
                    }
                    await this.page.keyboard.press('Enter');
                }
                await sleep(300);
            }
        } catch (e) {
            logger.warn('Aviso no preenchimento do mês', { error: e.message });
        }

        // 2. Dia
        try {
            const dayInput = await this.page.$('input#day, input[name="day"]');
            if (dayInput) {
                await this.humanEngine.humanType(this.page, dayInput, dayVal, false);
                await sleep(200);
            }
        } catch (e) {
            logger.warn('Aviso no preenchimento do dia', { error: e.message });
        }

        // 3. Ano
        try {
            const yearInput = await this.page.$('input#year, input[name="year"]');
            if (yearInput) {
                await this.humanEngine.humanType(this.page, yearInput, yearVal, false);
                await sleep(200);
            }
        } catch (e) {
            logger.warn('Aviso no preenchimento do ano', { error: e.message });
        }

        // 4. Gênero: Abrir dropdown Material e clicar na opção correspondente
        try {
            const genderTrigger = await this.page.$('#gender [role="combobox"], #gender, div[aria-label*="Gender" i]');
            if (genderTrigger) {
                await this.humanEngine.humanClick(this.page, genderTrigger);
                await sleep(500);

                // Google Gender: 0 = Female/Feminino, 1 = Male/Masculino
                const targetGenderIdx = isFemale ? 0 : 1;
                const genderSelected = await this.page.evaluate((targetIdx, wantFemale) => {
                    const listboxes = Array.from(document.querySelectorAll('ul[role="listbox"]'));
                    const listbox = document.querySelector('ul[role="listbox"][aria-label*="Gender" i], #gender ul[role="listbox"]') || listboxes[listboxes.length - 1];
                    if (listbox) {
                        const options = Array.from(listbox.querySelectorAll('li[role="option"]'));
                        // Tentar por texto primeiro para robustez multilíngue
                        const textMatch = options.find(o => {
                            const t = (o.innerText || '').toLowerCase();
                            return wantFemale ? (t.includes('female') || t.includes('feminin')) : (t.includes('male') || t.includes('masculin'));
                        });
                        const target = textMatch || options[targetIdx];
                        if (target) {
                            target.click();
                            return target.innerText;
                        }
                    }
                    return null;
                }, targetGenderIdx, isFemale);

                if (genderSelected) {
                    logger.info(`Gênero selecionado: ${genderSelected}`);
                } else {
                    const arrowCount = isFemale ? 1 : 2;
                    for (let k = 0; k < arrowCount; k++) {
                        await this.page.keyboard.press('ArrowDown');
                        await sleep(50);
                    }
                    await this.page.keyboard.press('Enter');
                }
                await sleep(300);
            }
        } catch (e) {
            logger.warn('Aviso no preenchimento do gênero', { error: e.message });
        }

        // 5. Clicar no botão Avançar
        logger.info('Submetendo Data de Nascimento e Gênero...');
        await PageDetector.clickNextButton(this.page, this.humanEngine);
        await this.humanEngine.delay('pageLoad');
    }

    async handleChooseEmailStep() {
        logger.info('Seleção de endereço de email...');
        try {
            // Se houver opções de rádio, selecionar a primeira sugestão válida do Google
            const radioButtons = await this.page.$$('input[type="radio"][name="identifier"], div[role="radio"]');
            if (radioButtons.length > 0) {
                await this.humanEngine.humanClick(this.page, radioButtons[0]);
                logger.info('Selecionada sugestão recomendada pelo Google');
            }
        } catch {
            // Tentar preencher username customizado se houver opção
            const customRadio = await this.page.$('input[type="radio"][value="custom"], div[aria-label*="próprio" i]');
            if (customRadio) {
                await this.humanEngine.humanClick(this.page, customRadio);
                await this.handleCustomUsernameStep();
                return;
            }
        }

        await PageDetector.clickNextButton(this.page, this.humanEngine);
        await this.humanEngine.delay('pageLoad');
    }

    async handleCustomUsernameStep() {
        logger.info(`Digitando nome de usuário: ${this.identity.username}`);
        const usernameInput = await this.page.$('input[name="Username"], #username');
        if (usernameInput) {
            await this.humanEngine.humanType(this.page, usernameInput, this.identity.username, false);
        }

        await PageDetector.clickNextButton(this.page, this.humanEngine);
        await this.humanEngine.delay('action');

        // Checar se o Google informou que o nome de usuário já existe
        const isTaken = await this.page.evaluate(() => {
            const body = document.body.innerText;
            return body.includes('já está em uso') || body.includes('already taken') || body.includes('Tente outro');
        });

        if (isTaken && usernameInput) {
            const newSuffix = randomInt(1000, 99999);
            this.identity.username = `${this.identity.username}${newSuffix}`;
            this.confirmedEmail = `${this.identity.username}@gmail.com`;
            logger.warn(`Username ocupado. Tentando novo: ${this.identity.username}`);
            await this.humanEngine.humanType(this.page, usernameInput, this.identity.username, false);
            await PageDetector.clickNextButton(this.page, this.humanEngine);
        }

        await this.humanEngine.delay('pageLoad');
    }

    async handlePasswordStep() {
        logger.info('Preenchendo senha...');
        const passwordInputs = await this.page.$$('input[type="password"], input[name="Passwd"], input[name="PasswdAgain"]');
        if (passwordInputs.length >= 1) {
            await this.humanEngine.humanType(this.page, passwordInputs[0], this.identity.password, false);
        }
        if (passwordInputs.length >= 2) {
            await this.humanEngine.humanType(this.page, passwordInputs[1], this.identity.password, false);
        }

        await PageDetector.clickNextButton(this.page, this.humanEngine);
        await this.humanEngine.delay('pageLoad');
    }

    async handlePhoneStep() {
        if (!this.smsProvider) {
            throw new Error('Provedor de SMS não configurado para verificação de número');
        }

        logger.info('Iniciando tratamento da verificação de telefone...');
        const maxRetries = 2;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                this.activePhoneSession = await this.smsProvider.getNumber();
                let rawPhone = String(this.activePhoneSession.phone).replace(/\D/g, '');
                logger.info(`Número obtido: +${rawPhone} (Tentativa ${retries + 1}/${maxRetries})`);

                // 1. Tentar ajustar a bandeira do país no Google para Indonésia (+62) se aplicável
                if (rawPhone.startsWith('62')) {
                    await this.selectCountryInGoogle('id', 'Indonésia', '62');
                }

                // 2. Localizar campo de telefone
                const phoneInput = await this.page.$('input[type="tel"], input[name="phoneNumberId"], #phoneNumberId');
                if (!phoneInput) {
                    throw new Error('Campo de input de telefone não encontrado no DOM');
                }

                // Limpar campo completamente
                await phoneInput.click({ clickCount: 3 });
                await this.page.keyboard.press('Backspace');
                await sleep(300);

                // Se a bandeira já estiver em +62, digitar com ou sem o prefixo dependendo do valor atual
                const formattedNumber = rawPhone.startsWith('62') ? `+${rawPhone}` : rawPhone;
                await this.humanEngine.humanType(this.page, phoneInput, formattedNumber, false);
                await sleep(500);

                // 3. Clicar no botão Avançar
                logger.info('Submetendo número no formulário do Google...');
                await PageDetector.clickNextButton(this.page, this.humanEngine);

                // 4. Aguardar transição de página ou mensagem de erro (até 12 segundos)
                let transitioned = false;
                let rejectionReason = null;

                for (let i = 0; i < 12; i++) {
                    await sleep(1000);
                    const state = await PageDetector.detectCurrentPage(this.page);

                    if (state.type !== PAGE_TYPES.PHONE_STEP) {
                        transitioned = true;
                        logger.info(`Página avançou com sucesso para: [${state.type}]`);
                        break;
                    }

                    // Checar mensagens de erro no DOM
                    rejectionReason = await this.page.evaluate(() => {
                        const alertEls = document.querySelectorAll('div[aria-live="assertive"], div[role="alert"], div.o6cuMc, div[jsname="B1UkEb"]');
                        for (const el of alertEls) {
                            const text = el.innerText?.trim();
                            if (text && text.length > 3) return text;
                        }
                        const body = document.body.innerText;
                        if (body.includes('usado muitas vezes') || body.includes('used too many times')) return 'Número já usado muitas vezes';
                        if (body.includes('não pode ser usado') || body.includes('cannot be used')) return 'Número não pode ser usado';
                        if (body.includes('formato') || body.includes('invalid format')) return 'Formato de telefone inválido';
                        return null;
                    });

                    if (rejectionReason) {
                        break;
                    }
                }

                if (!transitioned) {
                    const reason = rejectionReason || 'Google não avançou da tela de telefone';
                    logger.warn(`Rejeição do Google: "${reason}". Cancelando número ID ${this.activePhoneSession.id}...`);

                    // Tirar screenshot para diagnóstico
                    try {
                        const screenshotPath = `output/erro_telefone_${this.activePhoneSession.id}.png`;
                        await this.page.screenshot({ path: screenshotPath, fullPage: true });
                        logger.info(`Screenshot do erro salvo em: ${screenshotPath}`);
                    } catch {}

                    await this.smsProvider.cancelNumber(this.activePhoneSession.id);
                    retries++;
                    await sleep(2000);
                    continue;
                }

                // Número aceito, pronto para receber o código SMS
                return;
            } catch (err) {
                logger.error('Erro na etapa de telefone', { error: err.message });
                if (this.activePhoneSession) {
                    await this.smsProvider.cancelNumber(this.activePhoneSession.id).catch(() => {});
                }
                retries++;
                await sleep(2000);
            }
        }

        throw new Error('Google recusou o número de telefone (mismatch de país, IP ou formato inválido). Lote interrompido para proteger saldo.');
    }

    /**
     * Tenta selecionar o país correto no dropdown de bandeiras do Google
     */
    async selectCountryInGoogle(countryCode, countryName, dialCode) {
        try {
            // Verificar se o seletor de país/bandeira está presente
            const countrySelector = await this.page.$('div[role="combobox"][aria-haspopup="listbox"], div[jsname="V67aGc"], div[aria-label*="país" i], div[aria-label*="country" i]');
            if (countrySelector) {
                logger.info(`Tentando ajustar país para ${countryName} (+${dialCode})...`);
                await countrySelector.click();
                await sleep(600);

                // Procurar opção na lista
                const option = await this.page.$(`li[data-value="${countryCode}"], li[data-country-code="${dialCode}"], [role="option"]:has-text("${countryName}")`);
                if (option) {
                    await option.click();
                    logger.info(`Bandeira selecionada com sucesso: ${countryName}`);
                    await sleep(500);
                } else {
                    // Pressionar Escape se não encontrar para fechar o menu
                    await this.page.keyboard.press('Escape');
                }
            }
        } catch (e) {
            logger.debug('Aviso ao ajustar bandeira do país', { error: e.message });
        }
    }

    async handleSmsCodeStep() {
        if (!this.activePhoneSession) {
            throw new Error('Sessão de telefone não encontrada para validação de SMS');
        }

        logger.info(`Aguardando recebimento do código SMS para ID ${this.activePhoneSession.id}...`);
        const { code } = await this.smsProvider.waitForCode(this.activePhoneSession.id, 90);

        logger.info(`Digitando código SMS: ${code}`);
        const codeInput = await this.page.$('input[name="code"], #code, input[id*="pin" i]');
        if (codeInput) {
            await this.humanEngine.humanType(this.page, codeInput, code, false);
            await PageDetector.clickNextButton(this.page, this.humanEngine);
            await this.smsProvider.finishActivation(this.activePhoneSession.id).catch(() => {});
        }
        await this.humanEngine.delay('pageLoad');
    }

    async handleRecoveryStep() {
        logger.info('Etapa de email/telefone de recuperação - Tentando pular...');
        // Procurar botão "Pular" / "Skip"
        const skipButton = await this.page.$('button:has-text("Pular"), button:has-text("Skip")');
        if (skipButton) {
            await this.humanEngine.humanClick(this.page, skipButton);
        } else {
            await PageDetector.clickNextButton(this.page, this.humanEngine);
        }
        await this.humanEngine.delay('pageLoad');
    }

    async handleTermsStep() {
        logger.info('Aceitando termos de privacidade e serviço...');
        await this.humanEngine.humanScroll(this.page, 600);
        await sleep(1000);
        await this.humanEngine.humanScroll(this.page, 800);
        await sleep(1500);

        const agreeButton = await this.page.$('button[jsname="bygnYe"], button:has-text("Concordo"), button:has-text("I agree")');
        if (agreeButton) {
            await this.humanEngine.humanClick(this.page, agreeButton);
        } else {
            await PageDetector.clickNextButton(this.page, this.humanEngine);
        }
        await this.humanEngine.delay('pageLoad');
    }
}

export default FlowManager;
