/**
 * Funções auxiliares gerais
 */

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
}

export function generateStrongPassword() {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%&*';

    let password = '';
    password += randomItem(uppercase);
    password += randomItem(lowercase);
    password += randomItem(numbers);
    password += randomItem(symbols);

    const allChars = uppercase + lowercase + numbers + symbols;
    const length = randomInt(12, 16);

    for (let i = password.length; i < length; i++) {
        password += randomItem(allChars);
    }

    // Embaralhar caracteres
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}
