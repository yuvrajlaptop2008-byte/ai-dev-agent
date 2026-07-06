import { useState, useEffect, useRef, useContext } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { socket, API, AppCtx } from '../App'

const STEP_STYLE = {
  init: { icon: '🚀', color: '#58a6ff' },
  iteration: { icon: '🔄', color: '#8b949e' },
  thinking: { icon: '💭', color: '#bc8cff' },
  tool_call: { icon: '🔧', color: '#d29922' },
  tool_result: { icon: '✅', color: '#3fb950' },
  tool_error: { icon: '❌', color: '#f85149' },
  complete: { icon: '🎯', color: '#3fb950' },
  warning: { icon: '⚠️', color: '#d29922' },
  error: { icon: '💥', color: '#f85149' },
}

const QUICK_TASKS = [
  { label: '🐛 Solve Issue', tmpl: 'Solve GitHub issue #{n} in {owner}/{repo}: read the issue, understand the codebase, write the fix, create a branch, commit changes, and open a PR' },
  { label: '📋 Review PR', tmpl: 'Review PR #{n} in {owner}/{repo}: check code quality, bugs, security, and post a detailed review comment' },
  { label: '🔍 Audit Repo', tmpl: 'Audit the {owner}/{repo} repository: check for bugs, security issues, outdated deps, and create issues for each finding' },
  { label: '📝 Write Tests', tmpl: 'Write comprehensive tests for {owner}/{repo}, create a new branch, add test files, and open a PR' },
  { label: '📚 Auto-Docs', tmpl: 'Generate documentation for {owner}/{repo}: README improvements, code comments, and API docs' },
  { label: '🔒 Security Scan', tmpl: 'Scan {owner}/{repo} for security vulnerabilities, report findings as GitHub issues with severity labels' },
  { label: '♻️ Refactor', tmpl: 'Refactor {owner}/{repo} for better code quality, patterns, and maintainability. Create a PR with changes' },
  { label: '🚀 Add CI/CD', tmpl: 'Add GitHub Actions CI/CD to {owner}/{repo} with tests, linting, and deployment workflow' },
  { label: '🔎 Web Research', tmpl: 'Research and summarize: ' },
  { label: '💻 Write Code', tmpl: 'Write code for: ' },
]

export default function Agent() {
  const { model, repoCtx, notify } = useContext(AppCtx)
  const [task, setTask] = useState('')
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState([])
  const [result, setResult] = useState(null)
  const [runs, setRuns] = useState([])
  const [activeRun, setActiveRun] = useState(null)
  const [mode, setMode] = useState('deep')
  const [currentRunId, setCurrentRunId] = useState(null)
  const [wasStopped, setWasStopped] = useState(false)
  const [tab, setTab] = useState('run') // run | history
  const stepsRef = useRef(null)

  useEffect(() => {
    loadRuns()
    socket.on('agent-start', ({ runId }) => { setActiveRun(runId); setCurrentRunId(runId); setSteps([]); setResult(null) })
    socket.on('agent-step', ({ step }) => setSteps(p => [...p, step]))
    socket.on('agent-done', ({ result, stopped }) => { setResult(result); setRunning(false); setWasStopped(!!stopped); loadRuns(); notify(stopped ? '🛑 Stopped' : '✅ Agent task complete!', stopped ? 'error' : 'success') })
    socket.on('agent-error', ({ error }) => { setResult(`❌ ${error}`); setRunning(false); notify(`❌ ${error}`, 'error') })
    return () => { socket.off('agent-start'); socket.off('agent-step'); socket.off('agent-done'); socket.off('agent-error') }
  }, [])

  useEffect(() => { stepsRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' }) }, [steps])

  const loadRuns = () => fetch(`${API}/agent/runs`).then(r => r.json()).then(setRuns).catch(() => {})

  const run = () => {
    if (!task.trim() || running) return
    setRunning(true); setSteps([]); setResult(null); setTab('run')
    socket.emit('run-agent', { task, model, repoOwner: repoCtx.owner, repoName: repoCtx.repo, mode })
  }

  const stop = () => {
    if (currentRunId) socket.emit('stop-agent', { runId: currentRunId })
  }

  const continueRun = () => {
    if (!currentRunId) return
    setRunning(true); setWasStopped(false); setResult(null)
    socket.emit('continue-agent', { runId: currentRunId })
  }

  const fillTemplate = (tmpl) => {
    setTask(tmpl.replace('{owner}', repoCtx.owner || 'owner').replace('{repo}', repoCtx.repo || 'repo').replace('{n}', ''))
  }

  const viewRun = async (id) => {
    const r = await fetch(`${API}/agent/runs/${id}`)
    const d = await r.json()
    setSteps(d.steps || [])
    setResult(d.result)
    setTab('run')
  }

  return (
    <div className="agent-layout">
      {/* Left: Task config */}
      <div className="agent-sidebar">
        <div className="panel">
          <div className="panel-title">🤖 Autonomous Agent</div>

          <div className="quick-tasks">
            {QUICK_TASKS.map(t => (
              <button key={t.label} className="quick-btn" onClick={() => fillTemplate(t.tmpl)}>{t.label}</button>
            ))}
          </div>

          <textarea className="task-input" placeholder="Describe your task in detail. The agent will plan, research, and execute autonomously..." value={task} onChange={e => setTask(e.target.value)} rows={6} />

          <div className="run-config">
            <div className="mode-toggle">
              <button className={`mode-btn ${mode === 'deep' ? 'active' : ''}`} onClick={() => setMode('deep')}>🧠 Deep</button>
              <button className={`mode-btn ${mode === 'fast' ? 'active' : ''}`} onClick={() => setMode('fast')}>⚡ Fast</button>
            </div>
          </div>

          {!running ? (
            wasStopped && currentRunId
              ? <div style={{display:'flex',gap:8}}>
                  <button className="run-btn" onClick={continueRun}>▶ Continue</button>
                  <button className="run-btn" onClick={run} style={{background:'var(--bg4)'}}>New Task</button>
                </div>
              : <button className="run-btn" onClick={run}>▶ Run Agent (runs until complete)</button>
          ) : (
            <button className="run-btn stop-btn" onClick={stop}>🛑 Stop Agent</button>
          )}
        </div>

        {/* Run history */}
        <div className="panel">
          <div className="panel-title">📜 History</div>
          <div className="runs">
            {runs.slice(0, 10).map(r => (
              <div key={r.id} className="run-row" onClick={() => viewRun(r.id)}>
                <span className={`run-status ${r.status}`}>{r.status === 'done' ? '✅' : r.status === 'error' ? '❌' : '⏳'}</span>
                <span className="run-task-txt">{r.task.slice(0, 50)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Execution view */}
      <div className="agent-main">
        <div className="agent-steps" ref={stepsRef}>
          {steps.length === 0 && !running && (
            <div className="agent-empty">
              <div style={{ fontSize: 64 }}>🤖</div>
              <h2>AI Dev Agent</h2>
              <p>Autonomous agent with 50+ tools: GitHub, web search, code execution, file system, VSCode, and more.</p>
              <div className="cap-grid">
                {['✅ Solve GitHub Issues', '✅ Create & merge PRs', '✅ Clone & edit repos', '✅ Search the web', '✅ Write & run code', '✅ Manage branches', '✅ Run CI/CD', '✅ Browse URLs', '✅ VSCode integration', '✅ Autonomous loop'].map(c => <span key={c} className="cap">{c}</span>)}
              </div>
            </div>
          )}

          {steps.map((s, i) => {
            const style = STEP_STYLE[s.type] || { icon: '•', color: '#8b949e' }
            return (
              <div key={i} className="step-card" style={{ borderLeftColor: style.color }}>
                <div className="step-header">
                  <span className="step-icon">{style.icon}</span>
                  <span className="step-type" style={{ color: style.color }}>{s.type}{s.tool ? ` → ${s.tool}` : ''}</span>
                  <span className="step-ts">{new Date(s.ts).toLocaleTimeString()}</span>
                </div>
                <div className="step-body">
                  {s.type === 'thinking' ? (
                    <ReactMarkdown components={{ code({ inline, className, children }) {
                      const lang = /language-(\w+)/.exec(className || '')?.[1]
                      return !inline && lang
                        ? <SyntaxHighlighter style={oneDark} language={lang} PreTag="div">{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                        : <code className="icode">{children}</code>
                    }}}>{s.content}</ReactMarkdown>
                  ) : (
                    <pre className="step-pre">{s.content || s.args || s.tool}</pre>
                  )}
                </div>
              </div>
            )
          })}

          {running && (
            <div className="step-card thinking-anim" style={{ borderLeftColor: '#58a6ff' }}>
              <div className="step-header"><span className="spin">⚙️</span><span className="step-type" style={{ color: '#58a6ff' }}>Working...</span></div>
            </div>
          )}

          {result && (
            <div className="result-card">
              <div className="result-title">🎯 Result</div>
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
