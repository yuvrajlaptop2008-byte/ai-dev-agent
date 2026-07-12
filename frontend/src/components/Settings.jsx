import { useState, useEffect, useContext } from 'react'
import { API, AppCtx } from '../App'

export default function Settings() {
  const { model, setModel, models, notify } = useContext(AppCtx)
  const [s, setS] = useState({})
  const [saved, setSaved] = useState(false)
  const [memData, setMemData] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const refreshModels = async () => { setRefreshing(true); await fetch(`${API}/models/refresh`, { method: 'POST' }); notify('✅ Model list refreshed', 'success'); setRefreshing(false) }
  const [webllmStatus, setWebllmStatus] = useState({})
  const [skills, setSkills] = useState([])
  const loginWeb = async (provider) => { await fetch(`${API}/webllm/login/${provider}`, { method: 'POST' }); notify(`Browser window opened for ${provider} — log in there`, 'success') }

  useEffect(() => {
    fetch(`${API}/memory`).then(r => r.json()).then(setS)
    fetch(`${API}/brain/memory`).then(r => r.json()).then(d => setMemData(d.result)).catch(() => {})
    fetch(`${API}/webllm/status`).then(r=>r.json()).then(setWebllmStatus).catch(()=>{})
    fetch(`${API}/brain/skills`).then(r=>r.json()).then(d=>setSkills(d.result||[])).catch(()=>{})
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

  const [rot, setRot] = useState({ gh1:'',gh2:'',gh3:'', or1:'',or2:'',or3:'', gm1:'',gm2:'',gm3:'', pool:'' })
  const [rotStatus, setRotStatus] = useState(null)

  useEffect(() => { fetch(`${API}/rotation/status`).then(r=>r.json()).then(setRotStatus).catch(()=>{}) }, [])

  const saveRotation = async () => {
    await fetch(`${API}/rotation/openrouter-keys`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ keys: [rot.or1,rot.or2,rot.or3] }) })
    await fetch(`${API}/rotation/gemini-keys`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ keys: [rot.gm1,rot.gm2,rot.gm3] }) })
    if (rot.pool) await fetch(`${API}/rotation/model-pool`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ models: rot.pool.split(',').map(m=>m.trim()) }) })
    const st = await fetch(`${API}/rotation/status`).then(r=>r.json())
    setRotStatus(st); notify('✅ Rotation pools saved', 'success')
  }

  return (
    <div className="settings-layout">
      <div className="panel">
        <div className="panel-title">🌐 Web LLMs (Claude / ChatGPT / Gemini)</div>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:10}}>Log in once per provider (opens a real browser window). Session persists — no API key needed.</p>
        {['claude','chatgpt','gemini','aistudio','glm'].map(p => (
          <div key={p} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{width:80,fontSize:13,textTransform:'capitalize'}}>{p}</span>
            <span style={{fontSize:11,color: webllmStatus[p]==='session saved'?'var(--green)':'var(--text3)'}}>{webllmStatus[p]||'unknown'}</span>
            <button className="mini-btn" onClick={()=>loginWeb(p)}>Log in</button>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-title">🔁 Key & Model Rotation</div>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:10}}>Add up to 3 keys each. Auto-rotates on rate-limit/auth errors. {rotStatus && `OpenRouter #${rotStatus.openrouterActive+1}/${rotStatus.openrouterKeys||0} · Gemini #${rotStatus.geminiActive+1}/${rotStatus.geminiKeys||0}`}</p>
        <div className="ss"><h4>OpenRouter Keys (free models)</h4>
          {[1,2,3].map(n => <input key={n} className="input" style={{marginBottom:6}} type="password" placeholder={`OpenRouter key #${n}`} value={rot[`or${n}`]} onChange={e=>setRot({...rot,[`or${n}`]:e.target.value})} />)}
        </div>
        <div className="ss"><h4>Gemini Keys (native, from aistudio.google.com/apikey)</h4>
          {[1,2,3].map(n => <input key={n} className="input" style={{marginBottom:6}} type="password" placeholder={`Gemini key #${n}`} value={rot[`gm${n}`]} onChange={e=>setRot({...rot,[`gm${n}`]:e.target.value})} />)}
        </div>
        <div className="ss"><h4>Model Rotation Pool (optional, comma-separated)</h4>
          <input className="input" placeholder="meta-llama/llama-3.3-70b-instruct:free, gemini-2.5-flash, deepseek/deepseek-chat-v3-0324:free" value={rot.pool} onChange={e=>setRot({...rot,pool:e.target.value})} />
        </div>
        <button className="btn btn-primary" onClick={saveRotation}>💾 Save Rotation Pools</button>
      </div>

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
        <div className="panel-title">🎓 Learned Skills ({skills.length})</div>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:10}}>ARIA extracts a reusable skill from every task it completes, and recalls the relevant ones before starting similar work — this is how it improves over time.</p>
        {skills.length ? skills.map((s,i) => (
          <div key={i} style={{background:'var(--bg3)',padding:'8px 10px',borderRadius:6,marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:600}}>{s.skill_name} <span style={{fontSize:11,color:'var(--text3)',fontWeight:400}}>used {s.uses||1}x</span></div>
            <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{s.approach}</div>
            {s.pitfalls && <div style={{fontSize:11,color:'var(--yellow)',marginTop:2}}>⚠️ {s.pitfalls}</div>}
          </div>
        )) : <div style={{color:'var(--text3)',fontSize:13,marginBottom:16}}>No skills learned yet — completes tasks to start building them</div>}
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
