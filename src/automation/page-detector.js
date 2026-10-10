import logger from '../utils/logger.js';

export const PAGE_TYPES = {
    NAME_STEP: 'NAME_STEP',
    DOB_GENDER_STEP: 'DOB_GENDER_STEP',
    CHOOSE_EMAIL_STEP: 'CHOOSE_EMAIL_STEP',
    CUSTOM_USERNAME_STEP: 'CUSTOM_USERNAME_STEP',
    PASSWORD_STEP: 'PASSWORD_STEP',
    PHONE_STEP: 'PHONE_STEP',
    SMS_CODE_STEP: 'SMS_CODE_STEP',
    RECOVERY_EMAIL_STEP: 'RECOVERY_EMAIL_STEP',
    TERMS_STEP: 'TERMS_STEP',
    COMPLETED: 'COMPLETED',
    UNKNOWN: 'UNKNOWN'
};

export class PageDetector {
    /**
     * Analisa o DOM da página ativa e classifica o estado do fluxo de cadastro
     */
    static async detectCurrentPage(page) {
        try {
            const url = page.url();

            const detectedType = await page.evaluate(() => {
                const isVisible = (el) => {
                    if (!el) return false;
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null && style.opacity !== '0';
                };

                const bodyText = (document.body.innerText || '').toLowerCase();

                // 1. Termos de Privacidade
                const termsBtn = document.querySelector('button[jsname="bygnYe"]');
                if (termsBtn && isVisible(termsBtn)) return 'TERMS_STEP';

                // 2. Concluído
                if (window.location.href.includes('myaccount.google.com') || window.location.href.includes('mail.google.com')) {
                    return 'COMPLETED';
                }

                // 3. Código SMS
                const codeInput = document.querySelector('input[name="code"], input[id="code"], input[aria-label*="código" i], input[aria-label*="code" i]');
                if (codeInput && isVisible(codeInput)) return 'SMS_CODE_STEP';

                // 4. Data de Nascimento e Gênero (Basic Information)
                const dayInput = document.querySelector('input[name="day"], #day');
                if (dayInput && isVisible(dayInput) && (bodyText.includes('basic information') || bodyText.includes('informações básicas') || bodyText.includes('birthday') || bodyText.includes('nascimento'))) {
                    return 'DOB_GENDER_STEP';
                }

                // 5. Nome e Sobrenome (Create a Google Account)
                const firstName = document.querySelector('input[name="firstName"], #firstName');
                if (firstName && isVisible(firstName)) return 'NAME_STEP';

                // 6. Escolha de Email / Username
                const radios = document.querySelectorAll('input[type="radio"][name="identifier"], div[role="radio"]');
                if (radios.length > 0 && Array.from(radios).some(isVisible)) {
                    return 'CHOOSE_EMAIL_STEP';
                }
                const usernameInput = document.querySelector('input[name="Username"], #username');
                if (usernameInput && isVisible(usernameInput)) {
                    return 'CUSTOM_USERNAME_STEP';
                }

                // 7. Senha
                const passwordInput = document.querySelector('input[name="Passwd"], input[type="password"]');
                if (passwordInput && isVisible(passwordInput)) return 'PASSWORD_STEP';

                // 8. Telefone
                const phoneInput = document.querySelector('input[type="tel"], input[name="phoneNumberId"], #phoneNumberId');
                if (phoneInput && isVisible(phoneInput) && (bodyText.includes('phone') || bodyText.includes('telefone') || bodyText.includes('número'))) {
                    return 'PHONE_STEP';
                }

                // 9. Email de Recuperação
                const recoveryInput = document.querySelector('input[type="email"][name="recoveryEmail"], input[aria-label*="recuperação" i]');
                if (recoveryInput && isVisible(recoveryInput)) return 'RECOVERY_EMAIL_STEP';

                return 'UNKNOWN';
            });

            return { type: detectedType, url };
        } catch (error) {
            logger.debug('Falha ao inspecionar estado da página', { error: error.message });
            return { type: PAGE_TYPES.UNKNOWN, url: page.url() };
        }
    }

    /**
     * Localiza e clica no botão "Avançar" / "Próxima" / "Next"
     */
    static async clickNextButton(page, humanEngine) {
        // 1. Tentar seletores CSS padrão do Google
        const nextSelectors = [
            'button[jsname="LgbsSe"]',
            '#collectNameNext',
            '#birthdaygenderNext',
            '#next',
            'button[type="submit"]'
        ];

        for (const selector of nextSelectors) {
            try {
                const btn = await page.$(selector);
                if (btn) {
                    const isVisible = await page.evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                    }, btn);

                    if (isVisible) {
                        if (humanEngine) {
                            await humanEngine.humanClick(page, btn);
                        } else {
                            await btn.click();
                        }
                        return true;
                    }
                }
            } catch {
                continue;
            }
        }

        // 2. Busca direta no DOM por botões com texto correspondente
        try {
            const clicked = await page.evaluate(() => {
                const isVisible = (el) => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                };

                const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                const targetBtn = buttons.find(b => {
                    if (!isVisible(b)) return false;
                    const text = (b.innerText || '').toLowerCase().trim();
                    return text === 'next' || text === 'próxima' || text === 'avançar' || text === 'seguir' || text === 'concordo' || text === 'i agree';
                });

                if (targetBtn) {
                    targetBtn.click();
                    return true;
                }
                return false;
            });

            if (clicked) {
                if (humanEngine) await humanEngine.delay('action');
                return true;
            }
        } catch {
            // Ignorar
        }

        return false;
    }
}

export default PageDetector;
