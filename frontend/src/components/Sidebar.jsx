import { useState, useEffect } from 'react'
import { API } from '../App'

const NAV = [
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'agent', icon: '🤖', label: 'Agent' },
  { id: 'github', icon: '🐙', label: 'GitHub' },
  { id: 'mcp', icon: '🔌', label: 'MCP' },
  { id: 'settings', icon: '⚙️', label: 'Settings' }
]

export default function Sidebar({ view, setView, model, setModel, models, connected, setConvId }) {
  const [convs, setConvs] = useState([])
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [allModels, setAllModels] = useState([])

  useEffect(() => {
    loadConvs()
    fetch(`${API}/models`).then(r => r.json()).then(d => {
      setAllModels(d.models || [])
    })
  }, [])

  const loadConvs = () => {
    fetch(`${API}/chat/conversations`).then(r => r.json()).then(setConvs).catch(() => {})
  }

  const newChat = async () => {
    const r = await fetch(`${API}/chat/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
    const conv = await r.json()
    setConvId(conv.id)
    setView('chat')
    loadConvs()
  }

  const deleteConv = async (e, id) => {
    e.stopPropagation()
    await fetch(`${API}/chat/conversations/${id}`, { method: 'DELETE' })
    loadConvs()
    setConvId(null)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">AI Dev Agent</span>
        </div>
        <div className={`dot ${connected ? 'dot-green' : 'dot-red'}`} title={connected ? 'Connected' : 'Disconnected'} />
      </div>

      <div className="model-selector" onClick={() => setShowModelPicker(!showModelPicker)}>
        <span className="model-label">Model</span>
        <span className="model-name">{model.split('/')[1] || model}</span>
        <span>▾</span>
      </div>

      {showModelPicker && (
        <div className="model-picker">
          <div className="model-picker-title">Presets</div>
          {Object.entries(models).map(([k, v]) => (
            <div key={v} className={`model-item ${model === v ? 'active' : ''}`} onClick={() => { setModel(v); setShowModelPicker(false) }}>
              {k}
            </div>
          ))}
          {allModels.length > 0 && <>
            <div className="model-picker-title" style={{marginTop:8}}>All Models</div>
            {allModels.slice(0, 30).map(m => (
              <div key={m.id} className={`model-item ${model === m.id ? 'active' : ''}`} onClick={() => { setModel(m.id); setShowModelPicker(false) }}>
                {m.id}
              </div>
            ))}
          </>}
        </div>
      )}

      <nav className="nav">
        {NAV.map(n => (
          <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)}>
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {view === 'chat' && (
        <div className="conv-section">
          <div className="conv-header">
            <span>Chats</span>
            <button className="btn btn-primary" onClick={newChat} style={{ padding: '4px 10px', fontSize: 12 }}>+ New</button>
          </div>
          <div className="conv-list">
            {convs.map(c => (
              <div key={c.id} className="conv-item" onClick={() => setConvId(c.id)}>
                <span className="conv-title">{c.title}</span>
                <button className="conv-del" onClick={(e) => deleteConv(e, c.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
