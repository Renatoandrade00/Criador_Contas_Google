import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import routes from './routes.js';
import { WebSocketHandler } from './websocket-handler.js';
import logger from '../utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(rootDir, 'public')));

// Rotas da API
app.use('/api', routes);

// Inicializar WebSocket Server acoplado ao servidor HTTP
const wsHandler = new WebSocketHandler(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    logger.info(`=======================================================`);
    logger.info(` Google Account Automator - Painel Web Ativo!`);
    logger.info(` Acesse no navegador: http://localhost:${PORT}`);
    logger.info(`=======================================================`);
});

export { app, server, wsHandler };
