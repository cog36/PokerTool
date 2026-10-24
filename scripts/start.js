import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const python = windows
  ? join(root, '.venv', 'Scripts', 'python.exe')
  : join(root, '.venv', 'bin', 'python');
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');

if (!existsSync(python)) {
  console.error('Project Python environment not found. Create .venv and install backend/requirements.txt first.');
  process.exit(1);
}
if (!existsSync(vite)) {
  console.error('Frontend dependencies not found. Run npm install first.');
  process.exit(1);
}

const pythonCheck = spawnSync(python, ['-c', 'import dotenv, fastapi, multipart, openai, pydantic, uvicorn'], {
  cwd: root,
  stdio: 'ignore',
});
if (pythonCheck.error || pythonCheck.status !== 0) {
  const installCommand = windows
    ? '.venv\\Scripts\\python.exe -m pip install -r backend\\requirements.txt'
    : '.venv/bin/python -m pip install -r backend/requirements.txt';
  console.error(`Python API dependencies are missing. Run: ${installCommand}`);
  process.exit(1);
}

// Import the real app before starting either server. Dependencies alone do not
// catch missing route imports, invalid annotations, or incomplete integrations.
const appCheck = spawnSync(python, ['-c', 'from backend.main import app'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  timeout: 15000,
});
if (appCheck.error || appCheck.status !== 0) {
  console.error('Python API could not load. Fix the error above, then run npm start again.');
  process.exit(1);
}

const processes = [];
let stopping = false;

function stop(code, message) {
  if (stopping) return;
  stopping = true;
  if (message) console.error(message);
  for (const child of processes) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
  process.exitCode = code;
}

function launch(command, args, label) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
  processes.push(child);
  child.on('error', error => stop(1, `${label} failed to start: ${error.message}`));
  child.on('exit', (code, signal) => {
    if (!stopping) {
      const exitCode = code ?? (signal ? 1 : 0);
      stop(exitCode, `${label} stopped; shutting down the other service.`);
    }
  });
  return child;
}

process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));

// A separately started PokerTool API can be reused without taking ownership of
// that process. Ctrl+C only stops children launched by this command.
async function apiReady() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/health', { signal: AbortSignal.timeout(800) });
    if (!response.ok) return false;
    const health = await response.json();
    return health.status === 'ok' && health.provider === 'Groq' && typeof health.configured === 'boolean';
  } catch { return false; }
}

// Only start the frontend once Python is actually serving health checks.
async function waitForApi() {
  const deadline = Date.now() + 15000;
  while (!stopping && Date.now() < deadline) {
    if (await apiReady()) return true;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!stopping) stop(1, 'Python API did not become ready on port 8000; shutting down.');
  return false;
}

if (await apiReady()) {
  console.log('Using the running PokerTool API on http://127.0.0.1:8000.');
} else {
  console.log('Starting Python API on http://127.0.0.1:8000…');
  launch(python, ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000'], 'Python API');
}
if (await waitForApi() && !stopping) {
  console.log('Python API is ready. Starting frontend on http://127.0.0.1:5173/');
  launch(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], 'Frontend');
}
