# Especificação Técnica (SPEC): Google Account Automator

## 1. Visão Geral do Documento
* **Projeto:** Google Account Automator (Criador de Contas Google)
* **Versão:** 1.0.0
* **Status:** Aprovado para Implementação
* **Documento Relacionado:** [PRD Criador de contas.md](file:///d:/Renato/PROJETOS/14%20-%20CRIADOR%20DE%20CONTAS%20GOOGLE/PRD%20Criador%20de%20contas.md)

---

## 2. Escopo e Objetivos do Sistema
O sistema destina-se a orquestrar e automatizar a criação em lote de contas do Google/Gmail de ponta a ponta com taxa de retenção operacional mínima de 70% em ambiente de proxies adequados. O sistema é composto por:
1. **Painel Web (Frontend SPA):** Configuração de parâmetros de lote, controle de execução e monitoramento em tempo real.
2. **Backend Orquestrador (Node.js ESM):** Gerenciador de tarefas, fila de workers com concorrência limitada (3 a 5 threads) e servidor de eventos em tempo real (WebSockets).
3. **Motor de Automação & Evasão (Puppeteer Stealth / Antidetect):** Navegador automatizado sem artefatos de detecção (`navigator.webdriver`), com emulação biométrica humana e suporte a provedores de SMS virtuais.
4. **Mecanismo de Persistência:** Exportação atômica e incremental de credenciais no formato padrão `email|senha|recovery`.

---

## 3. Especificação dos Módulos Funcionais

### 3.1. Painel de Controle e Parâmetros (RF01)
* **Entradas de Configuração:**
  * `totalAccounts` (Integer, min: 1, max: 1000): Quantidade total de contas a criar no lote.
  * `concurrency` (Integer, min: 1, max: 5): Número de sessões de navegador em paralelo.
  * `executionMode` (Enum: `CONSERVATIVE` | `AGGRESSIVE`):
    * `CONSERVATIVE`: Delays longos (2000ms a 6000ms), aquecimento de sessão, digitação lenta com erros propositais, rotação estrita de proxy a cada tentativa.
    * `AGGRESSIVE`: Delays curtos (300ms a 900ms), navegação direta, foco em vazão máxima.
  * `smsProvider` (Enum: `SMS_ACTIVATE` | `FIVESIM` | `SMS_VERIFY`): Seleção do provedor de SMS temporário.
  * `smsApiKey` (String, obrigatória): Token de autenticação da API de SMS.
  * `smsCountry` (String/Integer): Código do país dos números de telefone.
  * `proxies` (Textarea / Arquivo): Lista de proxies no formato `ip:port` ou `ip:port:user:pass`.
* **Ações de Controle:**
  * `Iniciar Lote` (`POST /api/batch/start`)
  * `Pausar Lote` (`POST /api/batch/pause`)
  * `Cancelar Lote` (`POST /api/batch/stop`)
  * `Download de Credenciais` (`GET /api/export/download`)

### 3.2. Motor de Automação e Fluxo do Google (RF02)
* **Identidade & Massa de Dados:**
  * Geração dinâmica de Primeiro Nome, Sobrenome, Dia, Mês, Ano (idade calculada entre 19 e 45 anos), Gênero (Masculino/Feminino).
  * Criação de senha forte criptograficamente segura (mínimo 12 caracteres, alfanumérica com símbolos).
* **Fluxo de Telas (Máquina de Estados de Cadastro):**
  1. `START`: Acessar `https://accounts.google.com/signup` (ou página inicial do Gmail com clique em "Criar conta").
  2. `NAME_FORM`: Preencher `firstName` e `lastName`.
  3. `DOB_GENDER_FORM`: Preencher dia, mês (dropdown), ano e gênero.
  4. `USERNAME_FORM`: 
     * Verificar se o Google exibiu lista de sugestões de emails ou campo de entrada livre.
     * Caso sugira opções de rádio: selecionar aleatoriamente ou preencher username personalizado.
     * Tratar feedback de "Nome de usuário já em uso" gerando sufixo numérico randômico e reenviando.
  5. `PASSWORD_FORM`: Digitar senha no campo principal e confirmação.
  6. `PHONE_VERIFY`: 
     * Detectar presença da tela de solicitação de telefone.
     * Chamar API de SMS para requisitar número temporário.
     * Inserir telefone e submeter.
     * Polling de 60 a 120s aguardando recebimento do código de 6 dígitos.
     * Caso o número seja rejeitado pelo Google ("Este número já foi usado muitas vezes"): cancelar número na API de SMS e tentar outro (até 3 retentativas).
     * Digitar código de verificação recebido.
  7. `RECOVERY_FORM`: Preencher email de recuperação pré-configurado ou clicar em "Pular" / "Skip".
  8. `TERMS_AND_FINISH`: Rolar até o final dos termos de privacidade e clicar em "Concordo" / "Criar conta".
  9. `COMPLETE`: Extrair endereço de email final confirmado e despachar evento de sucesso.

### 3.3. Exportação e Persistência Incremental (RF03)
* **Formato de Saída Obrigatório:**
  ```text
  email|senha|recovery
  ```
  *(Caso não haja email de recuperação, será registrado o telefone verificado ou placeholder `none`)*.
* **Mecanismo de Gravação:**
  * Gravação síncrona `appendFile` com `flush` no arquivo `output/contas_criadas.txt` e `output/contas_criadas.md`.
  * Cada conta criada com sucesso é persistida antes de qualquer outra operação.

---

## 4. Especificações Não Funcionais (RNF)

| Identificador | Requisito | Métrica / Critério de Aceitação |
|---|---|---|
| **RNF01** | Anti-Detecção | `navigator.webdriver === false`, CDC markers removidos, plugins consistentes, WebGL unmasked vendor coerente, resolução compatível com tela real. |
| **RNF02** | Concorrência | Suporte operacional a 3-5 instâncias de navegador simultâneas sem vazamento de memória ou travamento de processo. |
| **RNF03** | Tolerância a Falhas | Isolamento de falhas por thread: a queda de um navegador ou falha de proxy não interrompe o lote global. |
| **RNF04** | Escalabilidade | Capacidade de orquestrar lotes de até 1.000 contas sem degradação de performance na API. |
| **RNF05** | Latência de UI | Atualizações do dashboard via WebSocket com latência inferior a 150ms após emissão do evento no backend. |

---

## 5. Especificação de Contratos de Dados & Interfaces

### 5.1. Modelo de Configuração de Lote (`BatchConfig`)
```typescript
interface BatchConfig {
  totalAccounts: number;       // Ex: 50
  concurrency: number;         // 1 a 5
  executionMode: "CONSERVATIVE" | "AGGRESSIVE";
  smsProvider: "SMS_ACTIVATE" | "FIVESIM" | "SMS_VERIFY";
  smsApiKey: string;
  smsCountry: string | number;
  proxies: string[];           // Lista de proxies normalizados
}
```

### 5.2. Modelo de Credencial Exportada (`AccountResult`)
```typescript
interface AccountResult {
  id: string;
  email: string;
  password: string;
  recovery: string;
  phoneUsed?: string;
  createdAt: string;           // ISO 8601
  status: "SUCCESS" | "FAILED";
  proxyUsed: string;
  failureReason?: string;
}
```

### 5.3. Mensagens de WebSocket (`ServerToClientEvents`)
```typescript
type WSEvent = 
  | { type: "BATCH_STATUS"; payload: { state: "IDLE" | "RUNNING" | "PAUSED" | "STOPPED"; progress: number; created: number; failed: number; successRate: number } }
  | { type: "LOG_EMITTED"; payload: { timestamp: string; level: "INFO" | "WARN" | "ERROR"; message: string; threadId?: number } }
  | { type: "ACCOUNT_CREATED"; payload: { email: string; createdAt: string } }
  | { type: "ACCOUNT_FAILED"; payload: { reason: string; threadId: number } };
```

---

## 6. Especificação de Endpoints REST

* `POST /api/batch/start`
  * **Payload:** `BatchConfig`
  * **Retorno:** `{ success: true, batchId: string, message: "Lote iniciado" }`
* `POST /api/batch/pause`
  * **Retorno:** `{ success: true, message: "Lote pausado" }`
* `POST /api/batch/stop`
  * **Retorno:** `{ success: true, message: "Lote cancelado" }`
* `GET /api/batch/status`
  * **Retorno:** Estado atual, contadores e métricas.
* `GET /api/export/download?format=txt|md`
  * **Retorno:** Download do arquivo de credenciais gerado até o momento.
* `POST /api/proxy/test`
  * **Payload:** `{ proxy: string }`
  * **Retorno:** `{ alive: boolean, ip: string, latencyMs: number }`
