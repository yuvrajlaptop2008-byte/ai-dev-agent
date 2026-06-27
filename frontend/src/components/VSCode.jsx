import { useState, useContext } from 'react'
import { API, AppCtx } from '../App'

export default function VSCode() {
  const { notify } = useContext(AppCtx)
  const [tab, setTab] = useState('open')
  const [path, setPath] = useState('/tmp/agent-workspace')
  const [line, setLine] = useState('')
  const [projName, setProjName] = useState('')
  const [projType, setProjType] = useState('node')
  const [extId, setExtId] = useState('')
  const [extensions, setExtensions] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [wsName, setWsName] = useState('my-workspace')

  const api = async (endpoint, body) => {
    setLoading(true); setResult('')
    try {
      const r = await fetch(`${API}/files/vscode/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      setResult(d.result || JSON.stringify(d, null, 2))
      notify(`✅ Done`, 'success')
    } catch (e) { setResult(`Error: ${e.message}`); notify(`❌ ${e.message}`, 'error') }
    setLoading(false)
  }

  const TABS = [
    { id: 'open', label: '📂 Open' },
    { id: 'project', label: '🏗️ New Project' },
    { id: 'workspace', label: '💼 Workspace' },
    { id: 'extensions', label: '🧩 Extensions' },
    { id: 'config', label: '⚙️ Configs' },
  ]

  const RECOMMENDED_EXTS = [
    { id: 'esbenp.prettier-vscode', label: 'Prettier', desc: 'Code formatter' },
    { id: 'dbaeumer.vscode-eslint', label: 'ESLint', desc: 'JavaScript linter' },
    { id: 'ms-python.python', label: 'Python', desc: 'Python support' },
    { id: 'GitHub.copilot', label: 'GitHub Copilot', desc: 'AI code completion' },
    { id: 'eamodio.gitlens', label: 'GitLens', desc: 'Git supercharged' },
    { id: 'ms-azuretools.vscode-docker', label: 'Docker', desc: 'Docker support' },
    { id: 'bradlc.vscode-tailwindcss', label: 'Tailwind CSS', desc: 'Tailwind autocomplete' },
    { id: 'ms-vscode.live-server', label: 'Live Server', desc: 'Local dev server' },
    { id: 'Prisma.prisma', label: 'Prisma', desc: 'Prisma ORM support' },
    { id: 'christian-kohler.path-intellisense', label: 'Path IntelliSense', desc: 'Autocomplete paths' },
    { id: 'PKief.material-icon-theme', label: 'Material Icons', desc: 'File icons' },
    { id: 'formulahendry.auto-rename-tag', label: 'Auto Rename Tag', desc: 'HTML auto-rename' },
  ]

  return (
    <div className="vs-layout">
      <div className="vs-sidebar">
        <div className="vs-header">
          <div className="vs-logo">💻 VS Code</div>
          <div className="vs-subtitle">Deep Integration</div>
        </div>
        {TABS.map(t => (
          <button key={t.id} className={`gh-nav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}

        {result && (
          <div className="vs-result-small panel" style={{ marginTop: 12 }}>
            <div className="panel-title" style={{ fontSize: 12 }}>Result</div>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--text2)' }}>{result.slice(0, 400)}</pre>
          </div>
        )}
      </div>

      <div className="vs-main">
        {tab === 'open' && (
          <div className="panel">
            <div className="panel-title">📂 Open in VS Code</div>
            <div className="sf"><label className="sl">File or Folder Path</label>
              <input className="input" value={path} onChange={e => setPath(e.target.value)} placeholder="/path/to/file-or-folder" />
            </div>
            <div className="sf"><label className="sl">Jump to Line (optional)</label>
              <input className="input" type="number" value={line} onChange={e => setLine(e.target.value)} placeholder="Line number" style={{ width: 120 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => api('open', { path, line: line || undefined })} disabled={loading}>📂 Open</button>
              <button className="btn" onClick={() => api('open-folder', { path })} disabled={loading}>📁 Open Folder</button>
            </div>
            <div className="vs-quick-paths">
              <div className="panel-title" style={{ marginTop: 16 }}>Quick Paths</div>
              {['/tmp/agent-workspace', '/home', '/tmp'].map(p => (
                <div key={p} className="vs-path-item" onClick={() => setPath(p)}>{p}</div>
              ))}
            </div>
          </div>
        )}

        {tab === 'project' && (
          <div className="panel">
            <div className="panel-title">🏗️ Create New Project</div>
            <div className="sf"><label className="sl">Project Name</label>
              <input className="input" value={projName} onChange={e => setProjName(e.target.value)} placeholder="my-awesome-project" />
            </div>
            <div className="sf"><label className="sl">Project Type</label>
              <select className="input" value={projType} onChange={e => setProjType(e.target.value)}>
                <option value="node">Node.js</option>
                <option value="express">Express API</option>
                <option value="react">React (Vite)</option>
                <option value="python">Python</option>
                <option value="fastapi">FastAPI</option>
              </select>
            </div>
            <button className="run-btn" onClick={() => api('create-project', { name: projName, type: projType })} disabled={loading || !projName}>
              {loading ? <><span className="spin">⏳</span> Creating...</> : '🏗️ Create & Open in VS Code'}
            </button>
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text2)' }}>
              Creates: package.json, index.js, .gitignore, README.md, .vscode/ (settings, launch, tasks, snippets)
            </div>
          </div>
        )}

        {tab === 'workspace' && (
          <div className="panel">
            <div className="panel-title">💼 VS Code Workspace</div>
            <div className="sf"><label className="sl">Workspace Name</label>
              <input className="input" value={wsName} onChange={e => setWsName(e.target.value)} placeholder="my-workspace" />
            </div>
            <button className="btn btn-primary" onClick={() => api('create-workspace', { name: wsName, folders: ['/tmp/agent-workspace'] })} disabled={loading}>
              💼 Create Workspace
            </button>
            <div style={{ marginTop: 16 }}>
              <div className="panel-title">Quick Actions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {[
                  { label: '⚙️ Setup Node Project', action: () => api('setup-project', { path: '/tmp/agent-workspace', type: 'node' }) },
                  { label: '⚙️ Setup Python Project', action: () => api('setup-project', { path: '/tmp/agent-workspace', type: 'python' }) },
                  { label: '🐛 Create launch.json', action: () => api('create-launch', { path: '/tmp/agent-workspace' }) },
                  { label: '📋 Create tasks.json', action: () => api('create-tasks', { path: '/tmp/agent-workspace' }) },
                  { label: '⚙️ Create settings.json', action: () => api('create-settings', { path: '/tmp/agent-workspace' }) },
                ].map(a => <button key={a.label} className="quick-btn" onClick={a.action} disabled={loading}>{a.label}</button>)}
              </div>
            </div>
          </div>
        )}

        {tab === 'extensions' && (
          <div className="panel">
            <div className="panel-title">🧩 VS Code Extensions</div>
            <div className="sf" style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={extId} onChange={e => setExtId(e.target.value)} placeholder="Extension ID (e.g. esbenp.prettier-vscode)" style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={() => api('install-ext', { id: extId })} disabled={loading || !extId}>Install</button>
            </div>
            <button className="btn" onClick={() => api('list-ext', {})} disabled={loading} style={{ marginBottom: 16 }}>📋 List Installed</button>

            <div className="panel-title">Recommended Extensions</div>
            <div className="ext-grid">
              {RECOMMENDED_EXTS.map(e => (
                <div key={e.id} className="ext-item">
                  <div>
                    <div className="ext-name">{e.label}</div>
                    <div className="ext-desc">{e.desc}</div>
                    <div className="ext-id">{e.id}</div>
                  </div>
                  <button className="mini-btn" onClick={() => api('install-ext', { id: e.id })} disabled={loading}>Install</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'config' && (
          <div className="panel">
            <div className="panel-title">⚙️ Project Configurations</div>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>Auto-generate VS Code configs for any project directory.</p>
            <div className="sf"><label className="sl">Project Directory</label>
              <input className="input" value={path} onChange={e => setPath(e.target.value)} placeholder="/path/to/project" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: '🏗️ Full Setup', action: () => api('setup-project', { path }) },
                { label: '🐛 Debug Config', action: () => api('create-launch', { path }) },
                { label: '📋 Tasks Config', action: () => api('create-tasks', { path }) },
                { label: '⚙️ Editor Settings', action: () => api('create-settings', { path }) },
              ].map(a => <button key={a.label} className="btn btn-primary" onClick={a.action} disabled={loading || !path}>{a.label}</button>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
