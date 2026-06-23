import { useState, useEffect, useRef } from 'react'
import { socket, API } from '../App'

export default function Agent({ model }) {
  const [task, setTask] = useState('')
  const [repoOwner, setRepoOwner] = useState('')
  const [repoName, setRepoName] = useState('')
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState([])
  const [result, setResult] = useState(null)
  const [runs, setRuns] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    loadRuns()
    socket.on('agent-start', ({ runId }) => { setSteps([]); setResult(null) })
    socket.on('agent-step', (step) => setSteps(p => [...p, step]))
    socket.on('agent-done', ({ result }) => { setResult(result); setRunning(false); loadRuns() })
    socket.on('agent-error', ({ error }) => { setResult(`Error: ${error}`); setRunning(false) })
    return () => { socket.off('agent-start'); socket.off('agent-step'); socket.off('agent-done'); socket.off('agent-error') }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [steps])

  const loadRuns = () => fetch(`${API}/agent/runs`).then(r => r.json()).then(setRuns).catch(() => {})

  const run = () => {
    if (!task.trim() || running) return
    setRunning(true); setSteps([]); setResult(null)
    socket.emit('run-agent', { task, model, repoOwner, repoName })
  }

  const STEP_ICONS = { thinking: '🤔', response: '💬', tool_call: '🔧', tool_result: '✅', tool_error: '❌' }

  const TEMPLATES = [
    { label: '🐛 Solve Issue', task: 'Analyze GitHub issue #{number} in {owner}/{repo}, research the cause, write a fix, and create a PR' },
    { label: '📋 Code Review', task: 'Review the code in {owner}/{repo}, find bugs, security issues, and suggest improvements' },
    { label: '🏗️ Plan Feature', task: 'Create a detailed technical plan for implementing: ' },
    { label: '🔍 Research', task: 'Research best practices and solutions for: ' },
    { label: '🧪 Write Tests', task: 'Write comprehensive tests for {owner}/{repo}' },
    { label: '📚 Document', task: 'Generate documentation for {owner}/{repo}' }
  ]

  return (
    <div className="agent-view">
      <div className="agent-left">
        <div className="panel">
          <h3 className="panel-title">🤖 Agent Task</h3>

          <div className="templates">
            {TEMPLATES.map(t => (
              <button key={t.label} className="template-btn" onClick={() => setTask(t.task)}>{t.label}</button>
            ))}
          </div>

          <div className="field-row">
            <input className="input" placeholder="GitHub Owner (optional)" value={repoOwner} onChange={e => setRepoOwner(e.target.value)} style={{ flex: 1 }} />
            <input className="input" placeholder="Repo (optional)" value={repoName} onChange={e => setRepoName(e.target.value)} style={{ flex: 1 }} />
          </div>

          <textarea
            className="input agent-textarea"
            placeholder="Describe the task in detail..."
            value={task}
            onChange={e => setTask(e.target.value)}
            rows={5}
          />

          <button className={`btn btn-primary run-btn ${running ? 'loading' : ''}`} onClick={run} disabled={running}>
            {running ? '⏳ Running...' : '▶ Run Agent'}
          </button>
        </div>

        <div className="panel">
          <h3 className="panel-title">📜 Recent Runs</h3>
          <div className="runs-list">
            {runs.map(r => (
              <div key={r.id} className="run-item">
                <span className={`badge badge-${r.status === 'done' ? 'green' : r.status === 'error' ? 'red' : 'yellow'}`}>{r.status}</span>
                <span className="run-task">{r.task.slice(0, 60)}...</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="agent-right">
        <div className="agent-steps">
          {steps.length === 0 && !running && (
            <div className="empty-state"><div className="empty-icon">🤖</div><p>Run an agent task to see the execution steps</p></div>
          )}
          {steps.map((s, i) => (
            <div key={i} className={`step step-${s.type}`}>
              <span className="step-icon">{STEP_ICONS[s.type] || '•'}</span>
              <div className="step-content">
                <div className="step-type">{s.type}{s.tool ? ` → ${s.tool}` : ''}</div>
                <pre className="step-text">{typeof s.content === 'string' ? s.content : s.result || s.error || JSON.stringify(s.args, null, 2)}</pre>
              </div>
            </div>
          ))}
          {running && <div className="step step-thinking"><span className="step-icon">⏳</span><div className="step-content"><div className="step-type">Working...</div></div></div>}
          {result && (
            <div className="agent-result">
              <h4>✅ Result</h4>
              <pre>{result}</pre>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
