/**
 * Frontend Application Controller - Google Account Automator
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elementos de UI
    const batchForm = document.getElementById('batchConfigForm');
    const btnStart = document.getElementById('btnStartBatch');
    const btnPause = document.getElementById('btnPauseBatch');
    const btnStop = document.getElementById('btnStopBatch');
    const btnClearLogs = document.getElementById('btnClearLogs');
    const btnDownloadTxt = document.getElementById('btnDownloadTxt');
    const btnDownloadMd = document.getElementById('btnDownloadMd');
    const btnTestFirstProxy = document.getElementById('btnTestFirstProxy');

    // Métricas
    const valCreated = document.getElementById('valCreated');
    const valFailed = document.getElementById('valFailed');
    const valSuccessRate = document.getElementById('valSuccessRate');
    const valActiveWorkers = document.getElementById('valActiveWorkers');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressText = document.getElementById('progressText');
    const systemStatusBadge = document.getElementById('systemStatusBadge');
    const systemStatusText = document.getElementById('systemStatusText');
    const terminalLogs = document.getElementById('terminalLogs');
    const wsIndicator = document.getElementById('wsIndicator');

    // Modos
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            modeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // Estado local
    let currentBatchStatus = 'IDLE';

    // Conexão WebSocket
    let ws = null;
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            wsIndicator.innerHTML = '<span class="indicator-dot"></span> Online';
            addLogLine('INFO', 'Conexão em tempo real estabelecida com o servidor.');
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleServerMessage(message);
            } catch (err) {
                console.error('Erro ao processar mensagem WS', err);
            }
        };

        ws.onclose = () => {
            wsIndicator.innerHTML = '<span class="indicator-dot" style="background:#ef4444;"></span> Desconectado';
            setTimeout(connectWebSocket, 3000);
        };
    }

    function handleServerMessage(message) {
        if (message.type === 'BATCH_STATUS') {
            updateDashboardMetrics(message.payload);
        } else if (message.type === 'LOG_ENTRY') {
            const entry = message.payload;
            addLogLine(entry.level, entry.message, entry.timestamp);
        }
    }

    function updateDashboardMetrics(metrics) {
        currentBatchStatus = metrics.status;
        valCreated.textContent = metrics.created;
        valFailed.textContent = metrics.failed;
        valSuccessRate.textContent = `${metrics.successRate}%`;
        valActiveWorkers.textContent = metrics.activeWorkers;

        const totalProcessed = metrics.created + metrics.failed;
        progressBarFill.style.width = `${metrics.progress}%`;
        progressText.textContent = `${totalProcessed} / ${metrics.totalRequested} (${metrics.progress}%)`;

        // Atualizar estado visual e botões
        const statusDot = systemStatusBadge.querySelector('.status-dot');
        statusDot.className = 'status-dot';

        if (metrics.status === 'RUNNING') {
            systemStatusText.textContent = 'Executando';
            statusDot.classList.add('running');
            btnStart.disabled = true;
            btnPause.disabled = false;
            btnStop.disabled = false;
            btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausar`;
        } else if (metrics.status === 'PAUSED') {
            systemStatusText.textContent = 'Pausado';
            statusDot.classList.add('paused');
            btnStart.disabled = true;
            btnPause.disabled = false;
            btnStop.disabled = false;
            btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Retomar`;
        } else {
            systemStatusText.textContent = 'Pronto';
            btnStart.disabled = false;
            btnPause.disabled = true;
            btnStop.disabled = true;
            btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausar`;
        }
    }

    function addLogLine(level, msg, timestamp) {
        const time = timestamp || new Date().toLocaleTimeString('pt-BR');
        const line = document.createElement('div');
        line.className = `log-line ${level.toLowerCase()}`;

        line.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-badge ${level.toLowerCase()}">${level}</span>
            <span class="log-msg">${escapeHtml(msg)}</span>
        `;

        terminalLogs.appendChild(line);

        // Limitar a 300 linhas para não sobrecarregar DOM
        while (terminalLogs.children.length > 300) {
            terminalLogs.removeChild(terminalLogs.firstChild);
        }

        terminalLogs.scrollTop = terminalLogs.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Ações de Botões
    batchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(batchForm);
        const payload = {
            totalAccounts: parseInt(formData.get('totalAccounts'), 10),
            concurrency: parseInt(formData.get('concurrency'), 10),
            executionMode: formData.get('executionMode'),
            smsProvider: formData.get('smsProvider'),
            smsApiKey: formData.get('smsApiKey'),
            smsCountry: formData.get('smsCountry'),
            proxies: formData.get('proxies')
        };

        try {
            const res = await fetch('/api/batch/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) {
                alert(`Erro ao iniciar lote: ${data.message}`);
            }
        } catch (err) {
            alert(`Erro na requisição: ${err.message}`);
        }
    });

    btnPause.addEventListener('click', async () => {
        const endpoint = currentBatchStatus === 'PAUSED' ? '/api/batch/resume' : '/api/batch/pause';
        await fetch(endpoint, { method: 'POST' });
    });

    btnStop.addEventListener('click', async () => {
        if (confirm('Tem certeza de que deseja cancelar a execução do lote atual?')) {
            await fetch('/api/batch/stop', { method: 'POST' });
        }
    });

    btnClearLogs.addEventListener('click', () => {
        terminalLogs.innerHTML = '';
    });

    btnDownloadTxt.addEventListener('click', () => {
        window.location.href = '/api/export/download?format=txt';
    });

    btnDownloadMd.addEventListener('click', () => {
        window.location.href = '/api/export/download?format=md';
    });

    btnTestFirstProxy.addEventListener('click', async () => {
        const proxiesText = document.getElementById('proxies').value.trim();
        const firstLine = proxiesText.split('\n')[0]?.trim();

        if (!firstLine) {
            alert('Insira ao menos um proxy na caixa de texto para testar.');
            return;
        }

        btnTestFirstProxy.textContent = 'Testando...';
        btnTestFirstProxy.disabled = true;

        try {
            const res = await fetch('/api/proxy/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proxy: firstLine })
            });
            const data = await res.json();

            if (data.alive) {
                alert(`Proxy Online!\nIP Externo: ${data.ip}\nLatência: ${data.latencyMs}ms`);
            } else {
                alert(`Falha no Proxy: ${data.error || 'Não respondeu'}\nLatência: ${data.latencyMs}ms`);
            }
        } catch (err) {
            alert(`Erro ao testar proxy: ${err.message}`);
        } finally {
            btnTestFirstProxy.textContent = 'Testar 1º Proxy';
            btnTestFirstProxy.disabled = false;
        }
    });

    // Carregar configurações padrão salvas no .env
    async function loadConfigDefaults() {
        try {
            const res = await fetch('/api/config/defaults');
            const defaults = await res.json();
            if (defaults.smsApiKey) {
                document.getElementById('smsApiKey').value = defaults.smsApiKey;
            }
            if (defaults.smsProvider) {
                document.getElementById('smsProvider').value = defaults.smsProvider;
            }
            if (defaults.smsCountry) {
                document.getElementById('smsCountry').value = defaults.smsCountry;
            }
        } catch {
            // Silencioso se falhar
        }
    }

    // Inicialização
    loadConfigDefaults();
    connectWebSocket();
});
