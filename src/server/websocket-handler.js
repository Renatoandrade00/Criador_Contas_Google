import { WebSocketServer } from 'ws';
import queueManager from '../core/queue-manager.js';
import { setLogEventEmitter } from '../utils/logger.js';

export class WebSocketHandler {
    constructor(server) {
        this.wss = new WebSocketServer({ server });
        this.clients = new Set();

        this.init();
    }

    init() {
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);

            // Enviar status atual imediato para o novo cliente conectado
            ws.send(JSON.stringify({
                type: 'BATCH_STATUS',
                payload: queueManager.getStatus()
            }));

            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });

        // Conectar emissão de logs ao WebSocket
        setLogEventEmitter((type, entry) => {
            this.broadcast({
                type: 'LOG_ENTRY',
                payload: entry
            });
        });

        // Conectar eventos do QueueManager ao WebSocket
        queueManager.setEventListener((type, payload) => {
            this.broadcast({
                type,
                payload
            });
        });
    }

    broadcast(data) {
        const message = JSON.stringify(data);
        for (const client of this.clients) {
            if (client.readyState === 1) { // OPEN
                client.send(message);
            }
        }
    }
}

export default WebSocketHandler;
