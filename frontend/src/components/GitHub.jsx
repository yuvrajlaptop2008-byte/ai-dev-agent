import { useState, useContext } from 'react'
import { API, AppCtx } from '../App'

export default function GitHub() {
  const { repoCtx, setRepoCtx, model, notify } = useContext(AppCtx)
  const [tab, setTab] = useState('issues')
  const [issues, setIssues] = useState([])
  const [prs, setPrs] = useState([])
  const [branches, setBranches] = useState([])
  const [commits, setCommits] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({})

  const { owner, repo } = repoCtx

  const load = async (endpoint, setter) => {
    if (!owner || !repo) return notify('Set owner/repo in sidebar', 'error')
    setLoading(true)
    const r = await fetch(`${API}/github/repos/${owner}/${repo}/${endpoint}`)
    setter(await r.json())
    setLoading(false)
  }

  const tabs = [
    { id: 'issues', label: '🐛 Issues', action: () => load('issues', setIssues) },
    { id: 'prs', label: '🔀 Pull Requests', action: () => load('prs', setPrs) },
    { id: 'branches', label: '🌿 Branches', action: () => load('branches', setBranches) },
    { id: 'commits', label: '📝 Commits', action: () => load('commits', setCommits) },
    { id: 'create-issue', label: '➕ New Issue', action: () => {} },
    { id: 'create-pr', label: '➕ New PR', action: () => {} },
  ]

  const switchTab = (t) => { setTab(t.id); setSelected(null); t.action(); }

  const viewIssue = async (n) => {
    const r = await fetch(`${API}/github/repos/${owner}/${repo}/issues/${n}`)
    setSelected({ type: 'issue', data: await r.json() })
  }

  const postComment = async () => {
    await fetch(`${API}/github/repos/${owner}/${repo}/issues/${selected.data.number}/comment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: form.comment })
    })
    notify('✅ Comment posted'); setForm({})
  }

  const createIssue = async () => {
    await fetch(`${API}/github/issues`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner, repo, ...form }) })
    notify('✅ Issue created'); setForm({}); load('issues', setIssues); setTab('issues')
  }

  return (
    <div className="gh-layout">
      <div className="gh-sidebar">
        <div className="gh-repo-info">
          <div className="gh-logo">🐙 GitHub</div>
          <div className="gh-repo-name">{owner}/{repo || '(no repo)'}</div>
        </div>
        <nav className="gh-nav">
          {tabs.map(t => (
            <button key={t.id} className={`gh-nav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => switchTab(t)}>{t.label}</button>
          ))}
        </nav>
      </div>

      <div className="gh-main">
        {loading && <div className="loading">Loading...</div>}

        {tab === 'issues' && !selected && (
          <div>
            <div className="gh-section-title">Issues ({issues.length})</div>
            {issues.map(i => (
              <div key={i.id} className="gh-item" onClick={() => viewIssue(i.number)}>
                <span className={`gh-state ${i.state}`}>{i.state === 'open' ? '🔴' : '✅'}</span>
                <span className="gh-item-title">#{i.number} {i.title}</span>
                <div className="gh-labels">{i.labels?.map(l => <span key={l.id} className="gh-label" style={{ background: `#${l.color}33`, color: `#${l.color}`, border: `1px solid #${l.color}66` }}>{l.name}</span>)}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'issues' && selected?.type === 'issue' && (
          <div className="gh-detail">
            <button className="back-btn" onClick={() => setSelected(null)}>← Back</button>
            <div className="gh-issue-title">#{selected.data.number} {selected.data.title}</div>
            <div className="gh-meta">State: <span className={`gh-state ${selected.data.state}`}>{selected.data.state}</span> | Author: {selected.data.user?.login}</div>
            <div className="gh-body"><pre>{selected.data.body}</pre></div>
            {selected.data.comments?.length > 0 && (
              <div className="gh-comments">
                <div className="gh-section-title">Comments ({selected.data.comments.length})</div>
                {selected.data.comments.map((c, i) => (
                  <div key={i} className="gh-comment">
                    <div className="gh-comment-author">{c.user?.login}</div>
                    <pre className="gh-comment-body">{c.body}</pre>
                  </div>
                ))}
              </div>
            )}
            <div className="gh-form">
              <textarea className="input" rows={3} placeholder="Add a comment..." value={form.comment || ''} onChange={e => setForm({ ...form, comment: e.target.value })} />
              <div className="gh-actions">
                <button className="btn btn-primary" onClick={postComment}>Post Comment</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'prs' && (
          <div>
            <div className="gh-section-title">Pull Requests ({prs.length})</div>
            {prs.map(p => (
              <div key={p.id} className="gh-item">
                <span className="gh-state open">🔀</span>
                <div>
                  <div className="gh-item-title">#{p.number} {p.title}</div>
                  <div className="gh-meta-small">{p.head?.ref} → {p.base?.ref} | by {p.user?.login}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'branches' && (
          <div>
            <div className="gh-section-title">Branches ({branches.length})</div>
            {branches.map(b => (
              <div key={b.name} className="gh-item">
                <span>🌿</span>
                <span className="gh-item-title">{b.name}</span>
                {b.protected && <span className="gh-label">🔒 protected</span>}
              </div>
            ))}
          </div>
        )}

        {tab === 'commits' && (
          <div>
            <div className="gh-section-title">Recent Commits</div>
            {commits.map(c => (
              <div key={c.sha} className="gh-item">
                <code className="commit-sha">{c.sha?.slice(0, 7)}</code>
                <div>
                  <div className="gh-item-title">{c.commit?.message?.split('\n')[0]}</div>
                  <div className="gh-meta-small">{c.commit?.author?.name} · {new Date(c.commit?.author?.date).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'create-issue' && (
          <div className="gh-form-page">
            <div className="gh-section-title">Create Issue</div>
            <input className="input" placeholder="Title" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
            <textarea className="input" rows={8} placeholder="Description (markdown supported)" value={form.body || ''} onChange={e => setForm({ ...form, body: e.target.value })} />
            <input className="input" placeholder="Labels (comma separated)" value={form.labels || ''} onChange={e => setForm({ ...form, labels: e.target.value })} />
            <button className="btn btn-primary" onClick={createIssue}>Create Issue</button>
          </div>
        )}

        {tab === 'create-pr' && (
          <div className="gh-form-page">
            <div className="gh-section-title">Create Pull Request</div>
            <input className="input" placeholder="Title" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input className="input" placeholder="Head branch (source)" value={form.head || ''} onChange={e => setForm({ ...form, head: e.target.value })} />
            <input className="input" placeholder="Base branch (target, e.g. main)" value={form.base || 'main'} onChange={e => setForm({ ...form, base: e.target.value })} />
            <textarea className="input" rows={6} placeholder="Description" value={form.body || ''} onChange={e => setForm({ ...form, body: e.target.value })} />
            <button className="btn btn-primary" onClick={async () => {
              await fetch(`${API}/github/repos/${owner}/${repo}/prs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
              notify('✅ PR created!'); setForm({}); setTab('prs'); load('prs', setPrs)
            }}>Create PR</button>
          </div>
        )}
      </div>
    </div>
  )
}
