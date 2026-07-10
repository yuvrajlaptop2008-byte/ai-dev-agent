import { useState, useContext } from 'react'
import ReactMarkdown from 'react-markdown'
import { API, AppCtx } from '../App'

export default function Research() {
  const { model, notify } = useContext(AppCtx)
  const [tab, setTab] = useState('research')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  const run = async (endpoint, body, label) => {
    if (!input.trim()) return
    setLoading(true); setResult('')
    const entry = { query: input, type: label, ts: new Date().toLocaleTimeString() }
    try {
      const r = await fetch(`${API}/brain/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, model }) })
      const d = await r.json()
      const res = typeof d.result === 'string' ? d.result : JSON.stringify(d.result, null, 2)
      setResult(res); entry.result = res
      notify(`✅ ${label} complete`, 'success')
    } catch (e) { setResult(`Error: ${e.message}`); entry.result = e.message }
    setLoading(false)
    setHistory(p => [entry, ...p.slice(0, 19)])
  }

  const actions = {
    research: { label: '🔬 Deep Research', fn: () => run('research', { topic: input, depth: 2 }, 'Research') },
    think: { label: '🧠 Deep Think', fn: () => run('think', { problem: input }, 'Think') },
    plan: { label: '📋 Create Plan', fn: () => run('plan', { goal: input }, 'Plan') },
    analyze: { label: '🔍 Analyze Code', fn: () => run('analyze', { code: input, task: 'full analysis' }, 'Analyze') },
    search: { label: '🌐 Web Search', fn: () => run('search', { query: input, num: 10 }, 'Search') },
  }

  return (
    <div className="research-layout">
      <div className="research-left">
        <div className="panel">
          <div className="panel-title">🔬 Intelligence Tools</div>
          <div className="res-tabs">
            {Object.entries(actions).map(([k, v]) => (
              <button key={k} className={`res-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{v.label}</button>
            ))}
          </div>

          <textarea className="task-input" rows={8} value={input} onChange={e => setInput(e.target.value)}
            placeholder={
              tab === 'research' ? 'Enter topic to research deeply (reads multiple web pages + synthesizes)...' :
              tab === 'think' ? 'Enter problem for deep AI reasoning and analysis...' :
              tab === 'plan' ? 'Enter goal to create a structured execution plan...' :
              tab === 'analyze' ? 'Paste code to analyze for bugs, security, performance...' :
              'Enter search query...'
            } />

          <button className={`run-btn ${loading ? 'running' : ''}`} onClick={actions[tab].fn} disabled={loading}>
            {loading ? <><span className="spin">⏳</span> Working...</> : `${actions[tab].label}`}
          </button>
        </div>

        <div className="panel">
          <div className="panel-title">📜 History ({history.length})</div>
          <div className="res-history">
            {history.map((h, i) => (
              <div key={i} className="res-hist-item" onClick={() => setResult(h.result)}>
                <span className="res-hist-type">{h.type}</span>
                <span className="res-hist-q">{h.query.slice(0, 40)}</span>
                <span className="res-hist-ts">{h.ts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="research-right">
        {loading && (
          <div className="res-loading">
            <div className="spin" style={{ fontSize: 32 }}>🔬</div>
            <p>Researching... (this may take a moment)</p>
          </div>
        )}
        {result && !loading && (
          <div className="res-result">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        )}
        {!result && !loading && (
          <div className="agent-empty">
            <div style={{ fontSize: 64 }}>🔬</div>
            <h2>Intelligence Tools</h2>
            <div className="cap-grid">
              {['🔬 Deep Research: searches + reads multiple pages', '🧠 Deep Think: step-by-step AI reasoning', '📋 Make Plan: structured execution plans', '🔍 Analyze Code: bugs, security, performance', '🌐 Web Search: multi-source web search'].map(c => <span key={c} className="cap">{c}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
