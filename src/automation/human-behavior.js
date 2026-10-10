import { sleep, randomInt } from '../utils/helpers.js';
import logger from '../utils/logger.js';

/**
 * Ponto em curva de Bézier cúbica
 */
function cubicBezier(t, p0, p1, p2, p3) {
    const u = 1 - t;
    return (u * u * u * p0) + (3 * u * u * t * p1) + (3 * u * t * t * p2) + (t * t * t * p3);
}

/**
 * Gera trajetória de mouse em curva suave com micro-jitter
 */
export function generateBezierPath(startX, startY, endX, endY, steps = 25) {
    const points = [];
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    const offsetX = (endX - startX) * (0.2 + Math.random() * 0.25) * (Math.random() > 0.5 ? 1 : -1);
    const offsetY = (endY - startY) * (0.2 + Math.random() * 0.25) * (Math.random() > 0.5 ? 1 : -1);

    const cp1x = midX + offsetX;
    const cp1y = midY + offsetY;
    const cp2x = midX - offsetX * 0.5;
    const cp2y = midY - offsetY * 0.5;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = cubicBezier(t, startX, cp1x, cp2x, endX);
        const y = cubicBezier(t, startY, cp1y, cp2y, endY);
        const jitterX = (Math.random() - 0.5) * 1.5;
        const jitterY = (Math.random() - 0.5) * 1.5;

        points.push({
            x: Math.round(x + jitterX),
            y: Math.round(y + jitterY)
        });
    }
    return points;
}

export class HumanBehaviorEngine {
    constructor(mode = 'CONSERVATIVE') {
        this.mode = mode.toUpperCase();
    }

    setMode(mode) {
        this.mode = mode.toUpperCase();
    }

    /**
     * Retorna atraso configurado conforme o modo
     */
    async delay(type = 'default') {
        if (this.mode === 'AGGRESSIVE') {
            switch (type) {
                case 'action': await sleep(randomInt(250, 600)); break;
                case 'pageLoad': await sleep(randomInt(600, 1200)); break;
                case 'short': await sleep(randomInt(100, 250)); break;
                default: await sleep(randomInt(200, 450)); break;
            }
        } else {
            // CONSERVATIVE
            switch (type) {
                case 'action': await sleep(randomInt(1200, 3000)); break;
                case 'pageLoad': await sleep(randomInt(2500, 5000)); break;
                case 'reading': await sleep(randomInt(1800, 4000)); break;
                case 'short': await sleep(randomInt(400, 800)); break;
                default: await sleep(randomInt(1000, 2200)); break;
            }
        }
    }

    /**
     * Move o cursor do mouse de forma fluida até o elemento
     */
    async humanMoveToElement(page, element) {
        try {
            const box = await element.boundingBox();
            if (!box) return;

            const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
            const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

            const startX = 100 + Math.random() * 200;
            const startY = 100 + Math.random() * 200;

            const steps = this.mode === 'AGGRESSIVE' ? 12 : 25;
            const path = generateBezierPath(startX, startY, targetX, targetY, steps);

            for (const pt of path) {
                await page.mouse.move(pt.x, pt.y);
                await sleep(randomInt(3, 8));
            }
        } catch {
            // Fallback silencioso
        }
    }

    /**
     * Clica em um elemento simulando intenção humana
     */
    async humanClick(page, element) {
        await this.humanMoveToElement(page, element);
        await this.delay('short');
        await element.click();
        await this.delay('action');
    }

    /**
     * Digitação humana com atrasos naturais e simulação de erros
     */
    async humanType(page, element, text, allowMistakes = true) {
        await element.focus();
        await this.delay('short');

        // Limpar campo se necessário
        await element.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await this.delay('short');

        const isConservative = this.mode === 'CONSERVATIVE';
        const mistakeChance = isConservative && allowMistakes ? 0.08 : 0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Simulação de erro ocasional
            if (Math.random() < mistakeChance && i > 1 && i < text.length - 1) {
                const wrongChar = String.fromCharCode(char.charCodeAt(0) + 1);
                await page.keyboard.sendCharacter(wrongChar);
                await sleep(randomInt(120, 280));
                await page.keyboard.press('Backspace');
                await sleep(randomInt(100, 220));
            }

            await page.keyboard.sendCharacter(char);

            // Atraso entre teclas
            const charDelay = isConservative ? randomInt(40, 130) : randomInt(25, 60);
            await sleep(charDelay);

            // Pausa de hesitação após símbolos como '.', '@' ou espaços
            if (['@', '.', '_', '-'].includes(char)) {
                await sleep(isConservative ? randomInt(200, 450) : randomInt(80, 150));
            }
        }

        await this.delay('short');
    }

    /**
     * Rolagem suave da página simulando leitura
     */
    async humanScroll(page, deltaY = 300) {
        try {
            await page.evaluate((y) => {
                window.scrollBy({ top: y, behavior: 'smooth' });
            }, deltaY);
            await this.delay('short');
        } catch {
            // Ignorar se página não permitir scroll
        }
    }
}

export default HumanBehaviorEngine;
