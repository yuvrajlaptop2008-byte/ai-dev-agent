import { useState, useRef, useEffect, useContext } from 'react'
import { API, AppCtx } from '../App'

export default function Terminal() {
  const [history, setHistory] = useState([{ type: 'system', text: 'AI Dev Agent Terminal — type commands or "help"' }])
  const [input, setInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState([])
  const [histIdx, setHistIdx] = useState(-1)
  const [cwd, setCwd] = useState('/tmp/agent-workspace')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history])

  const run = async (cmd) => {
    if (!cmd.trim()) return
    setHistory(p => [...p, { type: 'input', text: `${cwd} $ ${cmd}` }])
    setCmdHistory(p => [cmd, ...p.slice(0, 99)])
    setInput(''); setHistIdx(-1)
    if (cmd === 'clear') { setHistory([]); return }
    if (cmd === 'help') {
      setHistory(p => [...p, { type: 'output', text: `Available commands:\n  Any bash command\n  clear - clear terminal\n  pwd/ls/cd <dir>\n  git clone/status/add/commit/push\n  npm install, pip install\n  node <file>, python <file>` }])
      return
    }
    setLoading(true)
    try {
      const r = await fetch(`${API}/files/exec`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: cmd, cwd }) })
      const d = await r.json()
      if (cmd.startsWith('cd ')) {
        const newDir = cmd.slice(3).trim()
        if (!d.stderr) setCwd(newDir.startsWith('/') ? newDir : `${cwd}/${newDir}`)
      }
      const out = (d.stdout || '') + (d.stderr ? `\n\x1b[31m${d.stderr}\x1b[0m` : '')
      setHistory(p => [...p, { type: d.stderr ? 'error' : 'output', text: out || '(no output)' }])
    } catch (e) {
      setHistory(p => [...p, { type: 'error', text: e.message }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  const onKey = (e) => {
    if (e.key === 'Enter') run(input)
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, cmdHistory.length - 1)
      setHistIdx(idx); setInput(cmdHistory[idx] || '')
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx); setInput(idx === -1 ? '' : cmdHistory[idx])
    }
  }

  return (
    <div className="terminal" onClick={() => inputRef.current?.focus()}>
      <div className="term-bar">
        <span className="term-dot red" /><span className="term-dot yellow" /><span className="term-dot green" />
        <span className="term-title">Terminal — {cwd}</span>
      </div>
      <div className="term-body">
        {history.map((h, i) => (
          <div key={i} className={`term-line term-${h.type}`}>
            <pre>{h.text}</pre>
          </div>
        ))}
        {loading && <div className="term-line term-system"><pre>⏳ Running...</pre></div>}
        <div className="term-input-row">
          <span className="term-prompt">{cwd} $&nbsp;</span>
          <input ref={inputRef} className="term-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} autoFocus spellCheck={false} />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
