import { useState, useEffect } from 'react'
import { API } from '../App'

const PRESETS = [
  { name: 'GitHub MCP', url: 'https://github-mcp-server.example.com', type: 'sse' },
  { name: 'Filesystem MCP', url: 'http://localhost:3002', type: 'stdio' },
  { name: 'Browser MCP', url: 'http://localhost:3003', type: 'sse' },
  { name: 'Search MCP', url: 'http://localhost:3004', type: 'sse' }
]

export default function MCP() {
  const [servers, setServers] = useState([])
  const [form, setForm] = useState({ name: '', url: '', type: 'sse' })
  const [testing, setTesting] = useState(null)

  useEffect(() => { loadServers() }, [])

  const loadServers = () => fetch(`${API}/mcp/servers`).then(r => r.json()).then(setServers).catch(() => {})

  const addServer = async () => {
    if (!form.name || !form.url) return
    await fetch(`${API}/mcp/servers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setForm({ name: '', url: '', type: 'sse' })
    loadServers()
  }

  const deleteServer = async (id) => {
    await fetch(`${API}/mcp/servers/${id}`, { method: 'DELETE' })
    loadServers()
  }

  const toggleServer = async (s) => {
    await fetch(`${API}/mcp/servers/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...s, enabled: !s.enabled }) })
    loadServers()
  }

  const testServer = async (id) => {
    setTesting(id)
    const r = await fetch(`${API}/mcp/servers/${id}/test`, { method: 'POST' })
    const d = await r.json()
    alert(d.ok ? '✅ Connected!' : `❌ Error: ${d.error}`)
    setTesting(null)
  }

  return (
    <div className="mcp-view">
      <div className="panel">
        <h3 className="panel-title">🔌 MCP Servers</h3>

        <div className="mcp-presets">
          <h4>Quick Add Presets</h4>
          <div className="preset-list">
            {PRESETS.map(p => (
              <button key={p.name} className="template-btn" onClick={() => setForm(p)}>{p.name}</button>
            ))}
          </div>
        </div>

        <div className="mcp-form">
          <input className="input" placeholder="Server Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Server URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
          <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="sse">SSE</option>
            <option value="stdio">Stdio</option>
            <option value="websocket">WebSocket</option>
          </select>
          <button className="btn btn-primary" onClick={addServer}>Add Server</button>
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Connected Servers ({servers.filter(s => s.enabled).length} active)</h3>
        {servers.length === 0 && <div className="empty-small">No MCP servers configured</div>}
        {servers.map(s => (
          <div key={s.id} className="server-item">
            <div className="server-info">
              <div className={`dot ${s.enabled ? 'dot-green' : 'dot-red'}`} />
              <span className="server-name">{s.name}</span>
              <span className="server-url">{s.url}</span>
              <span className="badge badge-blue">{s.type}</span>
            </div>
            <div className="server-actions">
              <button className="btn" onClick={() => testServer(s.id)} disabled={testing === s.id}>{testing === s.id ? '...' : '🔍 Test'}</button>
              <button className="btn" onClick={() => toggleServer(s)}>{s.enabled ? 'Disable' : 'Enable'}</button>
              <button className="btn btn-danger" onClick={() => deleteServer(s.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3 className="panel-title">📖 MCP Protocol Info</h3>
        <div className="info-grid">
          <div className="info-item"><strong>SSE</strong><span>Server-Sent Events - for remote servers</span></div>
          <div className="info-item"><strong>Stdio</strong><span>Standard I/O - for local processes</span></div>
          <div className="info-item"><strong>WebSocket</strong><span>Bidirectional - for real-time tools</span></div>
        </div>
      </div>
    </div>
  )
}
