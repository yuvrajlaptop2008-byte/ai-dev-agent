import { useState, useEffect } from 'react'
import { API } from '../App'

export default function Settings({ currentModel, setModel, models }) {
  const [settings, setSettings] = useState({ github_token: '', openrouter_key: '', system_prompt: '', default_model: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`${API}/memory`).then(r => r.json()).then(s => setSettings(prev => ({ ...prev, ...s })))
  }, [])

  const save = async () => {
    await fetch(`${API}/memory/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { ...settings, default_model: currentModel } })
    })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const Field = ({ label, k, type = 'text', rows }) => (
    <div className="setting-field">
      <label className="setting-label">{label}</label>
      {rows ? (
        <textarea className="input" rows={rows} value={settings[k] || ''} onChange={e => setSettings({ ...settings, [k]: e.target.value })} />
      ) : (
        <input className="input" type={type} value={settings[k] || ''} onChange={e => setSettings({ ...settings, [k]: e.target.value })} />
      )}
    </div>
  )

  return (
    <div className="settings-view">
      <div className="panel">
        <h3 className="panel-title">⚙️ Settings</h3>

        <div className="settings-section">
          <h4>🔑 API Keys</h4>
          <Field label="GitHub Personal Access Token" k="github_token" type="password" />
          <Field label="OpenRouter API Key" k="openrouter_key" type="password" />
        </div>

        <div className="settings-section">
          <h4>🤖 Model Settings</h4>
          <div className="setting-field">
            <label className="setting-label">Default Model</label>
            <select className="input" value={currentModel} onChange={e => setModel(e.target.value)}>
              {Object.entries(models).map(([k, v]) => <option key={v} value={v}>{k} — {v}</option>)}
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h4>📝 System Prompt</h4>
          <Field label="Agent System Prompt" k="system_prompt" rows={6} />
        </div>

        <button className={`btn btn-primary ${saved ? 'saved' : ''}`} onClick={save} style={{ marginTop: 16 }}>
          {saved ? '✅ Saved!' : '💾 Save Settings'}
        </button>
      </div>

      <div className="panel">
        <h3 className="panel-title">ℹ️ About</h3>
        <div className="about-info">
          <p><strong>AI Dev Agent</strong> — Autonomous coding assistant</p>
          <p>GitHub: <a href="https://github.com/yuvrajlaptop2008-byte/ai-dev-agent" target="_blank">yuvrajlaptop2008-byte/ai-dev-agent</a></p>
          <div className="features-list">
            {['✅ Multi-model switching via OpenRouter', '✅ GitHub Issues & PR automation', '✅ Autonomous agent with tool use', '✅ MCP server integration', '✅ Streaming responses', '✅ Conversation history', '✅ Code execution', '✅ Web search'].map(f => <div key={f}>{f}</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
