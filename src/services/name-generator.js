import { randomInt, randomItem, generateStrongPassword } from '../utils/helpers.js';

const FIRST_NAMES_MALE = [
    'Arthur', 'Bernardo', 'Carlos', 'Daniel', 'Eduardo', 'Felipe', 'Gabriel',
    'Henrique', 'Igor', 'Joao', 'Lucas', 'Mateus', 'Nicolas', 'Otavio',
    'Pedro', 'Rafael', 'Samuel', 'Thiago', 'Vinicius', 'William', 'Alex',
    'David', 'James', 'Michael', 'Robert', 'John', 'Thomas', 'Brian', 'Kevin'
];

const FIRST_NAMES_FEMALE = [
    'Alice', 'Beatriz', 'Camila', 'Diana', 'Elena', 'Fernanda', 'Gabriela',
    'Helena', 'Isabela', 'Julia', 'Larissa', 'Mariana', 'Natalia', 'Olivia',
    'Patricia', 'Rafaela', 'Sophia', 'Tatiana', 'Valentina', 'Yasmin', 'Emma',
    'Sarah', 'Jessica', 'Emily', 'Chloe', 'Mia', 'Laura', 'Amanda', 'Rachel'
];

const LAST_NAMES = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
    'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
    'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha',
    'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado',
    'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Santana', 'Teixeira', 'Smith',
    'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'
];

export function generateIdentity() {
    const isMale = Math.random() > 0.5;
    const gender = isMale ? '1' : '2'; // 1 = Masculino, 2 = Feminino no Google (ou valores select correspondentes)
    const genderLabel = isMale ? 'MALE' : 'FEMALE';
    const firstName = isMale ? randomItem(FIRST_NAMES_MALE) : randomItem(FIRST_NAMES_FEMALE);
    const lastName = randomItem(LAST_NAMES);

    // Idade entre 20 e 42 anos
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - randomInt(20, 42);
    const birthMonth = randomInt(1, 12);
    const birthDay = randomInt(1, 28); // 28 para evitar problemas de meses curtos

    // Gerar username base sem acentos ou caracteres especiais
    const cleanFirst = firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleanLast = lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const randomSuffix = randomInt(100, 9999);
    
    // Variações de username plausíveis
    const usernamePatterns = [
        `${cleanFirst}.${cleanLast}${randomSuffix}`,
        `${cleanFirst}${cleanLast}${randomSuffix}`,
        `${cleanLast}.${cleanFirst}${randomSuffix}`,
        `${cleanFirst}${randomInt(10, 99)}.${cleanLast}`
    ];
    const username = randomItem(usernamePatterns);
    const email = `${username}@gmail.com`;
    const password = generateStrongPassword();

    return {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        gender,
        genderLabel,
        birthDay: String(birthDay),
        birthMonth: String(birthMonth),
        birthYear: String(birthYear),
        username,
        email,
        password
    };
}
