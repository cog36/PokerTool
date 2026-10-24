import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = process.cwd();
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

console.log('Starting Python API on http://127.0.0.1:8000 and frontend on http://127.0.0.1:5173/');
launch(python, ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000'], 'Python API');
launch(process.execPath, [resolve(vite), '--host', '127.0.0.1'], 'Frontend');

process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
