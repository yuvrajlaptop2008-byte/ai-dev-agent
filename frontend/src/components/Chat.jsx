import { useState, useEffect, useRef, useContext } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { socket, API, AppCtx } from '../App'

export default function Chat() {
  const { model, convId, setConvId } = useContext(AppCtx)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuf, setStreamBuf] = useState('')
  const bottomRef = useRef(null)
  const taRef = useRef(null)

  useEffect(() => {
    if (convId) fetch(`${API}/chat/conversations/${convId}/messages`).then(r => r.json()).then(d => setMessages(d)).catch(() => {})
    else setMessages([])
  }, [convId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamBuf])

  useEffect(() => {
    socket.on('chunk', c => setStreamBuf(p => p + c))
    socket.on('done', () => {
      setStreaming(false); setStreamBuf('')
      if (convId) fetch(`${API}/chat/conversations/${convId}/messages`).then(r => r.json()).then(setMessages).catch(() => {})
    })
    socket.on('error', () => { setStreaming(false); setStreamBuf('') })
    return () => { socket.off('chunk'); socket.off('done'); socket.off('error') }
  }, [convId])

  const send = async () => {
    if (!input.trim() || streaming) return
    const txt = input; setInput('')
    let cid = convId
    if (!cid) {
      const r = await fetch(`${API}/chat/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: txt.slice(0, 50), model }) })
      cid = (await r.json()).id; setConvId(cid)
    }
    setMessages(p => [...p, { role: 'user', content: txt }])
    setStreaming(true); setStreamBuf('')
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    socket.emit('stream-chat', { messages: [...history, { role: 'user', content: txt }], model, convId: cid })
  }

  const MD = ({ children }) => (
    <ReactMarkdown components={{ code({ inline, className, children }) {
      const lang = /language-(\w+)/.exec(className || '')?.[1]
      return !inline && lang
        ? <SyntaxHighlighter style={oneDark} language={lang} PreTag="div">{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
        : <code className="icode">{children}</code>
    }}}>{children}</ReactMarkdown>
  )

  const STARTERS = ['Explain how neural networks work', 'Write a Python web scraper', 'How do I optimize a PostgreSQL query?', 'Create a REST API in Node.js', 'Debug this: TypeError: cannot read property of undefined', 'Best practices for React performance']

  return (
    <div className="chat-layout">
      <div className="chat-msgs">
        {messages.length === 0 && !streaming && (
          <div className="empty">
            <div style={{ fontSize: 56 }}>⚡</div>
            <h2>ARIA Chat</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 20 }}>Multi-model AI chat with streaming. Ask anything.</p>
            <div className="suggs">{STARTERS.map(s => <button key={s} className="sugg" onClick={() => setInput(s)}>{s}</button>)}</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="msg-av">{m.role === 'user' ? '👤' : '⚡'}</div>
            <div className="msg-body"><MD>{m.content}</MD></div>
          </div>
        ))}
        {streaming && (
          <div className="msg assistant">
            <div className="msg-av">⚡</div>
            <div className="msg-body"><MD>{streamBuf || '...'}</MD></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-in">
        <div className="chat-in-wrap">
          <textarea ref={taRef} className="chat-ta" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message ARIA... (Shift+Enter for newline)" rows={1} disabled={streaming} />
          <button className="send" onClick={send} disabled={streaming}>{streaming ? '⏳' : '➤'}</button>
        </div>
        <div className="chat-hint">Model: <strong>{model}</strong> · Enter to send · Shift+Enter for newline</div>
      </div>
    </div>
  )
}
