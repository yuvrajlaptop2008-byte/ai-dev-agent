/**
 * VSCODE - Deep VS Code Integration
 * Controls VS Code via CLI, generates configs, manages extensions, workspaces
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

const WORKSPACE_ROOT = process.env.WORKSPACE || '/tmp/agent-workspace';

async function run(cmd, opts = {}) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000, ...opts });
    return { ok: true, out: (stdout + stderr).trim() };
  } catch (e) {
    return { ok: false, out: e.message, code: e.code };
  }
}

// ─── CHECK VSCODE AVAILABLE ───────────────────────────────
async function isAvailable() {
  const r = await run('code --version 2>/dev/null || code-insiders --version 2>/dev/null || echo "unavailable"');
  return !r.out.includes('unavailable') && r.out.length > 0;
}

// ─── OPEN FILE/FOLDER ─────────────────────────────────────
async function open(targetPath, options = {}) {
  const absPath = path.isAbsolute(targetPath) ? targetPath : path.join(WORKSPACE_ROOT, targetPath);
  const flags = [options.reuse ? '-r' : '', options.newWindow ? '-n' : '', options.wait ? '-w' : '', options.goto ? `-g "${targetPath}"` : ''].filter(Boolean).join(' ');
  const r = await run(`code ${flags} "${absPath}" 2>/dev/null || echo "VSCode CLI not available - path: ${absPath}"`);
  return r.out.includes('not available') ? `ℹ️ VSCode not running. File at: ${absPath}` : `✅ Opened in VSCode: ${absPath}`;
}

// ─── OPEN SPECIFIC LINE ───────────────────────────────────
async function openAtLine(filePath, line, column = 1) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(WORKSPACE_ROOT, filePath);
  const r = await run(`code -g "${absPath}:${line}:${column}" 2>/dev/null || echo "not available"`);
  return r.out.includes('not available') ? `File: ${absPath}:${line}` : `✅ Opened ${filePath}:${line}`;
}

// ─── INSTALL EXTENSION ───────────────────────────────────
async function installExtension(extensionId) {
  const r = await run(`code --install-extension ${extensionId} 2>/dev/null || echo "CLI not available"`);
  return r.out.includes('not available') ? `Extension ${extensionId} (install via VSCode UI)` : `✅ Extension installed: ${extensionId}`;
}

// ─── LIST EXTENSIONS ──────────────────────────────────────
async function listExtensions() {
  const r = await run('code --list-extensions 2>/dev/null || echo ""');
  return r.out ? r.out.split('\n').filter(Boolean) : [];
}

// ─── CREATE WORKSPACE FILE ───────────────────────────────
async function createWorkspace(name, folders, settings = {}) {
  const wsPath = path.join(WORKSPACE_ROOT, `${name}.code-workspace`);
  await fs.mkdir(WORKSPACE_ROOT, { recursive: true });

  const defaultSettings = {
    'editor.formatOnSave': true,
    'editor.tabSize': 2,
    'editor.minimap.enabled': true,
    'editor.wordWrap': 'on',
    'terminal.integrated.defaultProfile.linux': 'bash',
    'git.autofetch': true,
    'extensions.autoUpdate': false,
    'editor.defaultFormatter': 'esbenp.prettier-vscode',
    'files.autoSave': 'afterDelay',
    'files.autoSaveDelay': 1000
  };

  const ws = {
    folders: (folders || [WORKSPACE_ROOT]).map(f => ({ path: f })),
    settings: { ...defaultSettings, ...settings },
    extensions: {
      recommendations: [
        'esbenp.prettier-vscode',
        'ms-python.python',
        'ms-vscode.vscode-typescript-next',
        'dbaeumer.vscode-eslint',
        'GitHub.copilot',
        'eamodio.gitlens',
        'ms-azuretools.vscode-docker',
        'bradlc.vscode-tailwindcss',
        'Prisma.prisma',
        'ms-vscode.live-server'
      ]
    }
  };

  await fs.writeFile(wsPath, JSON.stringify(ws, null, 2));
  await run(`code "${wsPath}" 2>/dev/null || true`);
  return wsPath;
}

// ─── CREATE .vscode/settings.json ────────────────────────
async function createSettings(projectDir, settings = {}) {
  const vscodeDir = path.join(projectDir, '.vscode');
  await fs.mkdir(vscodeDir, { recursive: true });

  const defaults = {
    'editor.formatOnSave': true,
    'editor.codeActionsOnSave': { 'source.fixAll.eslint': true },
    'editor.tabSize': 2,
    'files.exclude': { 'node_modules': true, '.git': true, 'dist': true, '__pycache__': true },
    'search.exclude': { 'node_modules': true, 'dist': true },
    'terminal.integrated.env.linux': { 'NODE_ENV': 'development' }
  };

  await fs.writeFile(path.join(vscodeDir, 'settings.json'), JSON.stringify({ ...defaults, ...settings }, null, 2));
  return vscodeDir;
}

// ─── CREATE LAUNCH CONFIG ────────────────────────────────
async function createLaunchConfig(projectDir, configs) {
  const vscodeDir = path.join(projectDir, '.vscode');
  await fs.mkdir(vscodeDir, { recursive: true });

  const defaultConfigs = [
    { type: 'node', request: 'launch', name: 'Launch Node.js', program: '${workspaceFolder}/index.js', console: 'integratedTerminal' },
    { type: 'node', request: 'attach', name: 'Attach to Node', port: 9229 },
    { type: 'python', request: 'launch', name: 'Launch Python', program: '${file}', console: 'integratedTerminal' },
    { type: 'chrome', request: 'launch', name: 'Launch Chrome', url: 'http://localhost:3000', webRoot: '${workspaceFolder}/src' }
  ];

  const launch = { version: '0.2.0', configurations: configs || defaultConfigs };
  await fs.writeFile(path.join(vscodeDir, 'launch.json'), JSON.stringify(launch, null, 2));
  return 'launch.json created';
}

// ─── CREATE TASKS ────────────────────────────────────────
async function createTasks(projectDir, tasks) {
  const vscodeDir = path.join(projectDir, '.vscode');
  await fs.mkdir(vscodeDir, { recursive: true });

  const defaultTasks = [
    { label: 'Build', type: 'npm', script: 'build', group: { kind: 'build', isDefault: true } },
    { label: 'Test', type: 'npm', script: 'test', group: { kind: 'test', isDefault: true } },
    { label: 'Start Dev', type: 'npm', script: 'dev', isBackground: true },
    { label: 'Lint', type: 'npm', script: 'lint' }
  ];

  const tasksConfig = { version: '2.0.0', tasks: tasks || defaultTasks };
  await fs.writeFile(path.join(vscodeDir, 'tasks.json'), JSON.stringify(tasksConfig, null, 2));
  return 'tasks.json created';
}

// ─── GENERATE SNIPPETS ───────────────────────────────────
async function createSnippets(projectDir, language, snippets) {
  const vscodeDir = path.join(projectDir, '.vscode');
  await fs.mkdir(vscodeDir, { recursive: true });

  const builtinSnippets = {
    javascript: {
      'Console Log': { prefix: 'clg', body: ['console.log($1);'], description: 'Console log' },
      'Arrow Function': { prefix: 'af', body: ['const $1 = ($2) => {', '\t$3', '};'], description: 'Arrow function' },
      'Async Function': { prefix: 'asyncf', body: ['const $1 = async ($2) => {', '\ttry {', '\t\t$3', '\t} catch (e) {', '\t\tconsole.error(e);', '\t}', '};'] }
    },
    python: {
      'Main Guard': { prefix: 'main', body: ['if __name__ == "__main__":', '\t$1'], description: 'Main guard' },
      'Try Except': { prefix: 'try', body: ['try:', '\t$1', 'except Exception as e:', '\tprint(f"Error: {e}")'] }
    }
  };

  const lang = language || 'javascript';
  await fs.writeFile(path.join(vscodeDir, `${lang}.code-snippets`), JSON.stringify(snippets || builtinSnippets[lang] || {}, null, 2));
  return `Snippets created for ${lang}`;
}

// ─── SETUP COMPLETE PROJECT IN VSCODE ────────────────────
async function setupProject(projectDir, type = 'node') {
  await fs.mkdir(projectDir, { recursive: true });
  const results = [];

  results.push(await createSettings(projectDir));
  results.push(await createLaunchConfig(projectDir));
  results.push(await createTasks(projectDir));
  results.push(await createSnippets(projectDir, type === 'python' ? 'python' : 'javascript'));

  // Create .editorconfig
  await fs.writeFile(path.join(projectDir, '.editorconfig'), `root = true\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n[*.py]\nindent_size = 4\n`);

  // Open workspace
  const wsPath = await createWorkspace(path.basename(projectDir), [projectDir]);
  results.push(`Workspace: ${wsPath}`);

  return results;
}

// ─── DIFF VIEW ───────────────────────────────────────────
async function showDiff(file1, file2) {
  const r = await run(`code --diff "${file1}" "${file2}" 2>/dev/null || diff "${file1}" "${file2}" 2>&1 | head -50`);
  return r.out;
}

// ─── SEARCH IN VSCODE WORKSPACE ──────────────────────────
async function searchWorkspace(query, include = '**/*', exclude = '**/node_modules/**') {
  const { execAsync: ea } = require('util').promisify;
  try {
    const { stdout } = await execAsync(`grep -r --include="*.js" --include="*.ts" --include="*.py" -n "${query}" "${WORKSPACE_ROOT}" 2>/dev/null | head -30`);
    return stdout || 'No matches found';
  } catch { return 'Search failed'; }
}

module.exports = { isAvailable, open, openAtLine, installExtension, listExtensions, createWorkspace, createSettings, createLaunchConfig, createTasks, createSnippets, setupProject, showDiff, searchWorkspace, WORKSPACE_ROOT };
