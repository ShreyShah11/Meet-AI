import { spawn } from 'child_process';
// Bot Process Manager - Spawns Python Sidecar
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonProcess = null;

export const startBotService = (port = 5001) => {
    const pythonScriptPath = path.join(__dirname, 'bot_runner.py');

    console.log(`[BotService] Starting Python service on port ${port}...`);
    console.log(`[BotService] Script: ${pythonScriptPath}`);

    // Spawn the python process
    // Assuming 'python' is in the PATH. If not, might need specific path or 'python3'
    pythonProcess = spawn('python', ['-u', pythonScriptPath], {
        env: { ...process.env, BOT_PORT: port.toString(), PYTHONIOENCODING: 'utf-8' },
        cwd: path.join(__dirname, '../') // Set CWD to backend root so imports work
    });

    pythonProcess.stdout.on('data', (data) => {
        // Log Python output to Node console with a prefix
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => console.log(`[BotService:Py] ${line}`));
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[BotService:Error] ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[BotService] Python process exited with code ${code}`);
        pythonProcess = null;
    });

    // Handle Node process exit to kill Python process
    process.on('exit', () => {
        if (pythonProcess) {
            pythonProcess.kill();
        }
    });
};

export const stopBotService = () => {
    if (pythonProcess) {
        console.log('[BotService] Stopping Python service...');
        pythonProcess.kill();
        pythonProcess = null;
    }
};
