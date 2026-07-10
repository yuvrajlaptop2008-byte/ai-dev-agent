import { useState, useEffect, useContext } from 'react'
import { API, AppCtx } from '../App'

const PRESETS = [
  { name: 'GitHub MCP', url: 'https://mcp.github.com', type: 'sse', desc: 'Official GitHub MCP' },
  { name: 'Filesystem MCP', url: 'http://localhost:3002', type: 'stdio', desc: 'Local filesystem access' },
  { name: 'Browser MCP', url: 'http://localhost:3003', type: 'sse', desc: 'Browser automation' },
  { name: 'Postgres MCP', url: 'http://localhost:3004', type: 'sse', desc: 'PostgreSQL queries' },
  { name: 'Slack MCP', url: 'http://localhost:3005', type: 'sse', desc: 'Slack integration' },
  { name: 'Notion MCP', url: 'https://mcp.notion.com/mcp', type: 'sse', desc: 'Notion workspace' },
]

export default function MCP() {
  const { notify } = useContext(AppCtx)
  const [servers, setServers] = useState([])
  const [form, setForm] = useState({ name: '', url: '', type: 'sse' })
  const [testing, setTesting] = useState(null)

  useEffect(() => { fetch(`${API}/mcp/servers`).then(r => r.json()).then(setServers).catch(() => {}) }, [])

  const reload = () => fetch(`${API}/mcp/servers`).then(r => r.json()).then(setServers).catch(() => {})

  const add = async () => {
    if (!form.name || !form.url) return
    await fetch(`${API}/mcp/servers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setForm({ name: '', url: '', type: 'sse' }); reload(); notify('✅ Server added', 'success')
  }

  const del = async id => { await fetch(`${API}/mcp/servers/${id}`, { method: 'DELETE' }); reload() }

  const toggle = async s => {
    await fetch(`${API}/mcp/servers/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...s, enabled: !s.enabled }) })
    reload()
  }

  const test = async id => {
    setTesting(id)
    const r = await fetch(`${API}/mcp/servers/${id}/test`, { method: 'POST' })
    const d = await r.json()
    notify(d.ok ? '✅ Connected!' : `❌ ${d.error}`, d.ok ? 'success' : 'error')
    setTesting(null)
  }

  return (
    <div className="mcp-layout">
      <div className="panel">
        <div className="panel-title">🔌 MCP Servers</div>
        <div className="mcp-presets">
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Quick add presets:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map(p => (
              <button key={p.name} className="quick-btn" onClick={() => setForm({ name: p.name, url: p.url, type: p.type })} title={p.desc}>{p.name}</button>
            ))}
          </div>
        </div>
        <div className="mcp-form" style={{ marginTop: 12 }}>
          <input className="input" placeholder="Server Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Server URL (http://...)" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
          <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ width: 'auto' }}>
            <option value="sse">SSE</option><option value="stdio">Stdio</option><option value="websocket">WebSocket</option>
          </select>
          <button className="btn btn-primary" onClick={add}>Add</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Active Servers ({servers.filter(s => s.enabled).length}/{servers.length})</div>
        {servers.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No MCP servers configured yet</div>}
        {servers.map(s => (
          <div key={s.id} className="srv-item">
            <div className={`status-dot ${s.enabled ? 'online' : 'offline'}`} style={{ flexShrink: 0 }} />
            <div className="srv-info">
              <span className="srv-name">{s.name}</span>
              <span className="srv-url">{s.url}</span>
              <span className="badge" style={{ background: 'var(--bg4)', color: 'var(--text2)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{s.type}</span>
            </div>
            <div className="srv-actions">
              <button className="mini-btn" onClick={() => test(s.id)} disabled={testing === s.id}>{testing === s.id ? '...' : 'Test'}</button>
              <button className="mini-btn" onClick={() => toggle(s)}>{s.enabled ? 'Disable' : 'Enable'}</button>
              <button className="mini-btn" style={{ color: 'var(--red)' }} onClick={() => del(s.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-title">📖 MCP Protocol</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[{ t: 'SSE', d: 'Server-Sent Events for remote servers' }, { t: 'Stdio', d: 'Standard I/O for local processes' }, { t: 'WebSocket', d: 'Bidirectional real-time' }].map(i => (
            <div key={i.t} style={{ background: 'var(--bg3)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>{i.t}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{i.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
