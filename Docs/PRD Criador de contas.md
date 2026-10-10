# Product Requirements Document (PRD): Google Account Automator

## 1. Visão Geral do Produto
O objetivo deste software é automatizar a criação de contas do Google em larga escala para fins de inscrição em canais do YouTube, minimizando a detecção de bots e centralizando a configuração em um painel web.

## 2. Objetivos Principais
- Criar contas Google em lote de forma automatizada.
- Evadir os sistemas de detecção de automação do Google.
- Fornecer interface amigável para configuração de volume e parâmetros.
- Exportar credenciais em formatos de texto simples (.txt / .md).

## 3. Requisitos Funcionais (RF)

### RF01: Painel de Configuração Web
- **Configuração de Volume:** Campo para definir a quantidade total de contas a serem criadas.
- **Seleção de Modo:** 
    - *Modo Conservador:* Delays longos, rotação rigorosa de proxy e warming de sessão.
    - *Modo Agressivo:* Processamento rápido, menor intervalo entre contas.
- **Gestão de Insumos:** Interface para inserir a API Key do provedor de SMS e a lista de Proxies.
- **Monitoramento:** Dashboard em tempo real mostrando: Contas Criadas / Falhas / Taxa de Sucesso %.

### RF02: Motor de Automação (Core)
- **Isolamento de Perfil:** Criação de instâncias de navegador com fingerprints distintos por conta.
- **Automação de Navegação:** Preenchimento de formulários, seleção de gênero e data de nascimento.
- **Integração de SMS:** Chamada automática a API de terceiros para recebimento de código de verificação.
- **Tratamento de Erros:** Sistema de retry automático para páginas que não carregam ou proxies lentos.

### RF03: Exportação de Dados
- **Salvamento Incremental:** Gravação imediata de cada conta criada no arquivo de destino.
- **Formato de Saída:** Geração de arquivo `.txt` ou `.md` com a sintaxe `email|senha|recovery`.

## 4. Requisitos Não Funcionais (RNF)
- **Anti-Detection:** O sistema não deve utilizar `webdriver: true` no navegador (uso de `puppeteer-extra-plugin-stealth` ou navegadores antidetect).
- **Concorrência:** Suporte a threads paralelas (ex: 3 a 5 contas simultâneas) para otimizar o tempo de criação.
- **Escalabilidade:** Arquitetura capaz de processar desde 10 até 1.000 contas por lote.

## 5. Fluxo do Usuário (User Flow)
1. Usuário acessa o Painel Web $\rightarrow$ Configura a quantidade de contas $\rightarrow$ Insere Chave de API de SMS $\rightarrow$ Inicia o processo.
2. Backend inicia a fila de processamento $\rightarrow$ Seleciona Proxy $\rightarrow$ Abre Navegador Antidetect.
3. Bot executa o fluxo de cadastro $\rightarrow$ Solicita SMS via API $\rightarrow$ Insere código $\rightarrow$ Finaliza conta.
4. Sistema grava as credenciais no arquivo `.txt` $\rightarrow$ Atualiza o Dashboard Web.

## 6. Critérios de Aceite
- O sistema deve conseguir criar ao menos 70% das contas solicitadas sem bloqueio imediato.
- As contas criadas devem ser capazes de realizar login manual posteriormente.
- O arquivo de saída deve estar formatado corretamente e acessível ao final do processo.
