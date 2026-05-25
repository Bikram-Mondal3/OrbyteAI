import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import forgeRouter from './routes/forge.js';
import chatRouter from './routes/chat.js';
import filesRouter from './routes/files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: ['../.env', '.env'] });

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/forge', forgeRouter);
app.use('/v1', chatRouter);
app.use('/files', filesRouter);

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

// Start MCP Server as a background process
let mcpChild = null;

const startMcpServer = () => {
    console.log("Starting MCP Server...");
    const tsxPath = path.join(__dirname, 'node_modules', '.bin', 'tsx');

    mcpChild = spawn(tsxPath, ['mcp_server.ts'], {
        stdio: 'inherit',
        shell: process.platform === 'win32' // On Windows, we often need shell for .bin files
    });

    mcpChild.on('error', (err) => {
        console.error('Failed to start MCP server:', err);
    });

    mcpChild.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            console.error(`MCP server exited with code ${code}`);
        }
        mcpChild = null;
    });
};

// Ensure child process is killed when parent exits
const cleanup = () => {
    if (mcpChild) {
        console.log("Shutting down MCP Server...");
        mcpChild.kill();
        mcpChild = null;
    }
};

process.on('exit', cleanup);
process.on('SIGINT', () => {
    cleanup();
    process.exit();
});
process.on('SIGTERM', () => {
    cleanup();
    process.exit();
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`PersonaForge server running on port ${PORT}`);
    startMcpServer();
});

// npx adk run agent.ts
