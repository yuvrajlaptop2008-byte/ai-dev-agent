import { useState, useEffect, useContext } from 'react'
import { API, AppCtx } from '../App'

export default function Settings() {
  const { model, setModel, models, notify } = useContext(AppCtx)
  const [s, setS] = useState({})
  const [saved, setSaved] = useState(false)
  const [memData, setMemData] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const refreshModels = async () => { setRefreshing(true); await fetch(`${API}/models/refresh`, { method: 'POST' }); notify('✅ Model list refreshed', 'success'); setRefreshing(false) }

  useEffect(() => {
    fetch(`${API}/memory`).then(r => r.json()).then(setS)
    fetch(`${API}/brain/memory`).then(r => r.json()).then(d => setMemData(d.result)).catch(() => {})
  }, [])

  const save = async () => {
    await fetch(`${API}/memory/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { ...s, default_model: model } }) })
    setSaved(true); notify('✅ Saved!', 'success'); setTimeout(() => setSaved(false), 2000)
  }

  const F = ({ label, k, type = 'text', rows, placeholder }) => (
    <div className="sf">
      <label className="sl">{label}</label>
      {rows
        ? <textarea className="input" rows={rows} placeholder={placeholder} value={s[k] || ''} onChange={e => setS({ ...s, [k]: e.target.value })} />
        : <input className="input" type={type} placeholder={placeholder} value={s[k] || ''} onChange={e => setS({ ...s, [k]: e.target.value })} />}
    </div>
  )

  return (
    <div className="settings-layout">
      <div className="panel">
        <div className="panel-title">⚙️ Settings</div>
        <div className="ss"><h4>🔑 API Keys</h4>
          <F label="GitHub Personal Access Token" k="github_token" type="password" placeholder="ghp_..." />
          <F label="OpenRouter API Key" k="openrouter_key" type="password" placeholder="sk-or-..." />
        </div>
        <div className="ss"><h4>🤖 Default Model</h4>
          <select className="input" value={model} onChange={e => setModel(e.target.value)}>
            <optgroup label="⚡ Presets">
              {Object.entries(models.presets || {}).map(([k, v]) => <option key={v} value={v}>{k} — {v}</option>)}
            </optgroup>
            <optgroup label="🌐 All Models">
              {(models.all || []).slice(0, 200).map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="ss"><h4>📝 Agent System Prompt</h4>
          <F label="Override ARIA system prompt (leave blank to use default)" k="system_prompt" rows={6} placeholder="You are an expert AI coding agent..." />
        </div>
        <button className={`btn btn-primary ${saved ? 'btn-saved' : ''}`} onClick={save} style={{ marginTop: 12 }}>
          {saved ? '✅ Saved!' : '💾 Save Settings'}
        </button>
        <button className="btn" onClick={refreshModels} disabled={refreshing} style={{ marginTop: 12, marginLeft: 8 }}>{refreshing ? '⏳ Refreshing...' : '🔄 Refresh Model List'}</button>
      </div>

      <div className="panel">
        <div className="panel-title">🧠 Agent Memory</div>
        {memData ? (
          <pre style={{ fontSize: 11, maxHeight: 300, overflow: 'auto', color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{JSON.stringify(memData, null, 2)}</pre>
        ) : <div style={{ color: 'var(--text3)', fontSize: 13 }}>No memories stored yet</div>}
      </div>

      <div className="panel">
        <div className="panel-title">ℹ️ ARIA Capabilities</div>
        <div className="caps-list">
          {[
            '🤖 80+ autonomous tools',
            '🧠 Deep thinking + reasoning engine',
            '📋 Multi-phase planning system',
            '⚖️ AI-powered decision making',
            '🔬 Deep web research (multi-page synthesis)',
            '🐙 Full GitHub: issues, PRs, branches, CI/CD',
            '📥 Git clone + local repo operations',
            '💻 Deep VS Code integration',
            '⌨️ Built-in terminal with history',
            '🌐 Browser: search, fetch, read any page',
            '📦 NPM/PyPI search & install',
            '🔄 200+ models via OpenRouter',
            '🔌 MCP server integration',
            '♾️ Autonomous loop (up to 25 iterations)',
            '💾 Persistent memory across sessions',
            '🏗️ Create complete projects from scratch'
          ].map(c => <div key={c} className="cap-row">{c}</div>)}
        </div>
      </div>
    </div>
  )
}
