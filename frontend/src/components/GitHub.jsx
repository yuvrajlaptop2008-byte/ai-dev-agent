import { useState } from 'react'
import { API } from '../App'

export default function GitHub({ model }) {
  const [owner, setOwner] = useState('yuvrajlaptop2008-byte')
  const [repo, setRepo] = useState('')
  const [repos, setRepos] = useState([])
  const [issues, setIssues] = useState([])
  const [selected, setSelected] = useState(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('issues')

  const loadRepos = async () => {
    setLoading(true)
    const r = await fetch(`${API}/github/repos/${owner}`)
    setRepos(await r.json())
    setLoading(false)
  }

  const loadIssues = async (r) => {
    setLoading(true); setRepo(r)
    const res = await fetch(`${API}/github/repos/${owner}/${r}/issues`)
    setIssues(await res.json())
    setLoading(false)
  }

  const viewIssue = async (num) => {
    const r = await fetch(`${API}/github/repos/${owner}/${repo}/issues/${num}`)
    setSelected(await r.json())
    setTab('issue')
  }

  const postComment = async () => {
    if (!comment.trim()) return
    await fetch(`${API}/github/repos/${owner}/${repo}/issues/${selected.number}/comment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: comment })
    })
    setComment('')
  }

  return (
    <div className="github-view">
      <div className="github-sidebar">
        <div className="panel">
          <h3 className="panel-title">🐙 GitHub</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="GitHub username" value={owner} onChange={e => setOwner(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={loadRepos}>Load</button>
          </div>
        </div>

        {repos.length > 0 && (
          <div className="panel">
            <h4 className="panel-title">Repositories</h4>
            <div className="repo-list">
              {repos.map(r => (
                <div key={r.id} className={`repo-item ${repo === r.name ? 'active' : ''}`} onClick={() => loadIssues(r.name)}>
                  <span className="repo-name">{r.name}</span>
                  <span className="badge badge-blue">{r.open_issues_count} issues</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="github-main">
        {tab === 'issues' && (
          <div>
            <h3 className="panel-title">{repo ? `Issues: ${owner}/${repo}` : 'Select a repository'}</h3>
            {loading && <div className="loading-text">Loading...</div>}
            <div className="issues-list">
              {issues.map(i => (
                <div key={i.id} className="issue-item" onClick={() => viewIssue(i.number)}>
                  <span className={`badge badge-${i.state === 'open' ? 'green' : 'red'}`}>{i.state}</span>
                  <span className="issue-title">#{i.number} {i.title}</span>
                  <span className="issue-labels">{i.labels?.map(l => <span key={l.id} className="label" style={{ background: `#${l.color}22`, color: `#${l.color}` }}>{l.name}</span>)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'issue' && selected && (
          <div className="issue-detail">
            <button className="btn" onClick={() => setTab('issues')} style={{ marginBottom: 16 }}>← Back</button>
            <div className="issue-header">
              <h2>#{selected.number} {selected.title}</h2>
              <span className={`badge badge-${selected.state === 'open' ? 'green' : 'red'}`}>{selected.state}</span>
            </div>
            <div className="issue-body">
              <pre className="issue-text">{selected.body}</pre>
            </div>
            {selected.comments?.length > 0 && (
              <div className="comments">
                <h4>Comments ({selected.comments.length})</h4>
                {selected.comments.map((c, i) => (
                  <div key={i} className="comment"><strong>{c.user?.login}</strong><pre>{c.body}</pre></div>
                ))}
              </div>
            )}
            <div className="comment-form">
              <textarea className="input" rows={3} placeholder="Add a comment..." value={comment} onChange={e => setComment(e.target.value)} />
              <button className="btn btn-primary" onClick={postComment}>Post Comment</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
