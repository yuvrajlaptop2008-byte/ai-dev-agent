import { useState, useEffect, useContext } from 'react'
import { API, AppCtx } from '../App'

const NAV = [
  { id: 'agent',    icon: '🤖', label: 'Agent' },
  { id: 'chat',     icon: '💬', label: 'Chat' },
  { id: 'research', icon: '🔬', label: 'Research' },
  { id: 'github',   icon: '🐙', label: 'GitHub' },
  { id: 'vscode',   icon: '💻', label: 'VS Code' },
  { id: 'terminal', icon: '⌨️', label: 'Terminal' },
  { id: 'mcp',      icon: '🔌', label: 'MCP' },
  { id: 'contribute', icon: '🤝', label: 'Contribute' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

export default function Sidebar({ view, setView, connected }) {
  const { model, setModel, models, repoCtx, setRepoCtx, convId, setConvId } = useContext(AppCtx)
  const [showModels, setShowModels] = useState(false)
  const [convs, setConvs] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (view === 'chat') fetch(`${API}/chat/conversations`).then(r => r.json()).then(setConvs).catch(() => {})
  }, [view, convId])

  const presetModels = Object.entries(models.presets || {})
  const allModelIds = (models.all || []).map(m => m.id)
  const filtered = search
    ? allModelIds.filter(id => id.toLowerCase().includes(search.toLowerCase()))
    : allModelIds

  const newChat = async () => {
    const r = await fetch(`${API}/chat/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
    const c = await r.json(); setConvId(c.id); setView('chat')
  }

  const delConv = async (e, id) => {
    e.stopPropagation()
    await fetch(`${API}/chat/conversations/${id}`, { method: 'DELETE' })
    fetch(`${API}/chat/conversations`).then(r => r.json()).then(setConvs)
    if (convId === id) setConvId(null)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="logo">⚡ <span>ARIA</span></div>
        <div className={`status-dot ${connected ? 'online' : 'offline'}`} title={connected ? 'Connected' : 'Disconnected'} />
      </div>

      {/* Model Picker */}
      <div className="model-pick-wrap">
        <div className="model-btn" onClick={() => setShowModels(!showModels)}>
          <span className="model-ico">🧠</span>
          <span className="model-cur">{(model.split('/')[1] || model).slice(0, 20)}</span>
          <span style={{ color: 'var(--text3)', fontSize: 10 }}>{showModels ? '▴' : '▾'}</span>
        </div>
        {showModels && (
          <div className="model-dropdown">
            <input className="model-search" placeholder="Search 200+ models..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            {!search && (
              <>
                <div className="model-group-label">⚡ Presets</div>
                {presetModels.map(([k, v]) => (
                  <div key={v} className={`model-opt ${model === v ? 'sel' : ''}`} onClick={() => { setModel(v); setShowModels(false); setSearch('') }}>
                    <span className="model-opt-name">{k}</span>
                    <span className="model-opt-id">{v}</span>
                  </div>
                ))}
              </>
            )}
            <div className="model-group-label">🆓 Free Models ({(models.free||[]).length})</div>
            {(models.free||[]).filter(id => !search || id.toLowerCase().includes(search.toLowerCase())).slice(0,40).map(id => (
              <div key={id+'f'} className={`model-opt ${model===id?'sel':''}`} onClick={() => { setModel(id); setShowModels(false); setSearch('') }}>
                <span className="model-opt-id">{id.replace(':free','')} <span className="model-opt-free">FREE</span></span>
              </div>
            ))}
            <div className="model-group-label">🌐 All OpenRouter ({models.all?.length || 0})</div>
            {filtered.slice(0, 80).map(id => (
              <div key={id} className={`model-opt ${model === id ? 'sel' : ''}`} onClick={() => { setModel(id); setShowModels(false); setSearch('') }}>
                <span className="model-opt-id">{id}</span>
              </div>
            ))}
            {filtered.length > 80 && <div style={{ padding: '6px 10px', color: 'var(--text3)', fontSize: 11 }}>+{filtered.length - 80} more — search to filter</div>}
          </div>
        )}
      </div>

      {/* Repo context */}
      <div className="repo-ctx">
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>🐙</span>
        <input className="repo-input" placeholder="owner" value={repoCtx.owner} onChange={e => setRepoCtx(p => ({ ...p, owner: e.target.value }))} />
        <span style={{ color: 'var(--text3)' }}>/</span>
        <input className="repo-input" placeholder="repo" value={repoCtx.repo} onChange={e => setRepoCtx(p => ({ ...p, repo: e.target.value }))} />
      </div>

      <nav className="nav">
        {NAV.map(n => (
          <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)}>
            <span className="nav-ico">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {view === 'chat' && (
        <div className="conv-panel">
          <div className="conv-hdr">
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>CHATS</span>
            <button className="mini-btn" onClick={newChat}>+ New</button>
          </div>
          <div className="conv-list">
            {convs.map(c => (
              <div key={c.id} className={`conv-it ${convId === c.id ? 'active' : ''}`} onClick={() => setConvId(c.id)}>
                <span className="conv-t">{c.title}</span>
                <button className="conv-del-btn" onClick={e => delConv(e, c.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <a href="https://github.com/yuvrajlaptop2008-byte/ai-dev-agent" target="_blank" className="gh-link">⭐ Star on GitHub</a>
      </div>
    </aside>
  )
}
