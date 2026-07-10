import { useState, useContext, useEffect } from 'react'
import { API, AppCtx } from '../App'

const ACTIONS = [
  { id: 'find-issues',    icon: '🔍', label: 'Find Good Issues',       desc: 'AI picks best issues to work on' },
  { id: 'solve-issue',    icon: '🐛', label: 'Solve Issue (Auto)',     desc: 'Read issue → write fix → open PR' },
  { id: 'improve-readme', icon: '📖', label: 'Improve README',         desc: 'AI rewrites README professionally' },
  { id: 'write-tests',    icon: '🧪', label: 'Write Tests',            desc: 'Auto-generate test files' },
  { id: 'add-ci',         icon: '⚙️', label: 'Add CI/CD',              desc: 'Add GitHub Actions workflow' },
  { id: 'auto-label',     icon: '🏷️', label: 'Auto-Label Issues',      desc: 'AI labels all unlabeled issues' },
  { id: 'add-contributing',icon:'🤝', label: 'Add CONTRIBUTING.md',    desc: 'Add contributing guide' },
  { id: 'add-templates',  icon: '📋', label: 'Add Issue Templates',    desc: 'Add bug/feature templates' },
  { id: 'build-project',  icon: '🚀', label: 'Build New OSS Project',  desc: 'Ship a complete new repo from an idea' },
  { id: 'strengthen',     icon: '💪', label: 'Strengthen My Profile',  desc: 'Fix every repo: desc, topics, README, LICENSE, CI' },
  { id: 'profile-readme', icon: '👤', label: 'Build Profile README',   desc: 'Write your github.com/you page' },
]

export default function Contribute() {
  const { model, repoCtx, notify } = useContext(AppCtx)
  const [issueNum, setIssueNum] = useState('')
  const [idea, setIdea] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(null)
  const [log, setLog] = useState([])
  const [history, setHistory] = useState([])

  useEffect(() => {
    const { owner, repo } = repoCtx
    if (owner && repo) fetch(`${API}/contributor/history/${owner}/${repo}`).then(r=>r.json()).then(setHistory).catch(()=>{})
  }, [repoCtx.owner, repoCtx.repo])

  const run = async (actionId) => {
    const { owner, repo } = repoCtx
    const repoOptional = ['build-project', 'strengthen', 'profile-readme'].includes(actionId)
    if (!owner || (!repoOptional && !repo)) { notify(repoOptional ? 'Set your GitHub username in sidebar' : 'Set owner/repo in sidebar', 'error'); return }
    setLoading(actionId); setResult(null); setLog([])

    let url, body
    if (actionId === 'find-issues') { url = `/api/contributor/find-issues/${owner}/${repo}?model=${model}`; body = null }
    else if (actionId === 'solve-issue') { url = '/api/contributor/solve-issue'; body = { owner, repo, issue_number: parseInt(issueNum), model } }
    else if (actionId === 'build-project') { url = '/api/builder/build'; body = { idea, model } }
    else if (actionId === 'strengthen') { url = `/api/builder/strengthen/${owner}`; body = { model } }
    else if (actionId === 'profile-readme') { url = `/api/builder/profile-readme/${owner}`; body = { model } }
    else { url = `/api/contributor/${actionId}`; body = { owner, repo, model } }

    try {
      const r = await fetch(`${url}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      const d = await r.json()
      if (d.error) { notify(`❌ ${d.error}`, 'error'); setResult(d.error) }
      else {
        setResult(d)
        if (d.log) setLog(d.log)
        notify('✅ Done!', 'success')
        const { owner, repo } = repoCtx
        fetch(`${API}/contributor/history/${owner}/${repo}`).then(r=>r.json()).then(setHistory).catch(()=>{})
      }
    } catch (e) { notify(`❌ ${e.message}`, 'error'); setResult(e.message) }
    setLoading(null)
  }

  return (
    <div className="contrib-layout">
      <div className="contrib-left">
        <div className="panel">
          <div className="panel-title">🤝 Contribute Like a Human</div>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
            AI agent contributes to {repoCtx.owner}/{repoCtx.repo || 'your repo'} — finds issues, writes fixes, creates PRs, improves docs.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label className="sl">Issue # (for "Solve Issue")</label>
            <input className="input" type="number" value={issueNum} onChange={e => setIssueNum(e.target.value)} placeholder="123" style={{ width: 120 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="sl">Project Idea (for "Build New OSS Project")</label>
            <input className="input" value={idea} onChange={e => setIdea(e.target.value)} placeholder="e.g. CLI tool that converts markdown to slides" />
          </div>

          <div className="action-grid">
            {ACTIONS.map(a => (
              <button key={a.id} className={`action-card ${loading === a.id ? 'loading' : ''}`} onClick={() => run(a.id)} disabled={!!loading}>
                <div className="action-icon">{loading === a.id ? <span className="spin">⏳</span> : a.icon}</div>
                <div className="action-label">{a.label}</div>
                <div className="action-desc">{a.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="contrib-right">
        {history.length > 0 && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="panel-title">📜 Contribution History ({history.length})</div>
            <div className="contrib-log">
              {history.map((h,i) => (
                <div key={i} className="log-line">{h.ts?.slice(0,10)} · {h.type}{h.prUrl?` · `:''}{h.prUrl && <a href={h.prUrl} target="_blank">PR</a>}</div>
              ))}
            </div>
          </div>
        )}
        {log.length > 0 && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="panel-title">📋 Log</div>
            <div className="contrib-log">
              {log.map((l, i) => <div key={i} className="log-line">{l}</div>)}
            </div>
          </div>
        )}

        {result && typeof result === 'object' && !result.log && (
          <div className="panel">
            <div className="panel-title">✅ Result</div>
            {Array.isArray(result) ? (
              result.map((item, i) => (
                <div key={i} className="result-item">
                  <div className="ri-number">#{item.number}</div>
                  <div>
                    <div className="ri-title">{item.title}</div>
                    <div className="ri-reason">{item.reason}</div>
                    <span className={`ri-diff ri-diff-${item.difficulty}`}>{item.difficulty}</span>
                  </div>
                </div>
              ))
            ) : (
              <div>
                {result.prUrl && <div className="pr-link">🔀 <a href={result.prUrl} target="_blank">{result.prUrl}</a></div>}
                {result.fix && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Approach: {result.fix.approach}</div>}
                {result.message && <div style={{ color: 'var(--green)' }}>{result.message}</div>}
                {result.preview && <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', marginTop: 8, color: 'var(--text2)' }}>{result.preview}</pre>}
              </div>
            )}
          </div>
        )}

        {typeof result === 'string' && (
          <div className="panel"><pre style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{result}</pre></div>
        )}

        {!result && !loading && (
          <div className="agent-empty">
            <div style={{ fontSize: 64 }}>🤝</div>
            <h2>Auto-Contribute</h2>
            <p>AI finds issues, writes code, creates PRs — exactly like a human contributor.</p>
            <div className="cap-grid">
              {['Reads full issue + comments','Researches the problem online','Writes production-ready fix','Creates branch + commits','Opens PR with description','Comments on issue with link','Adds tests, docs, CI'].map(c=><span key={c} className="cap">{c}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
