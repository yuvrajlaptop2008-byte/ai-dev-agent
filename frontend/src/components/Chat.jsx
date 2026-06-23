import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { socket, API } from '../App'

export default function Chat({ model, convId, setConvId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (convId) loadMessages()
    else setMessages([])
  }, [convId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

  useEffect(() => {
    socket.on('chunk', (c) => setStreamContent(p => p + c))
    socket.on('done', () => {
      setStreaming(false)
      setStreamContent('')
      if (convId) loadMessages()
    })
    return () => { socket.off('chunk'); socket.off('done') }
  }, [convId])

  const loadMessages = async () => {
    const r = await fetch(`${API}/chat/conversations/${convId}/messages`)
    const data = await r.json()
    setMessages(data)
  }

  const send = async () => {
    if (!input.trim() || streaming) return
    const text = input; setInput('')

    if (!convId) {
      const r = await fetch(`${API}/chat/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: text.slice(0, 40), model }) })
      const conv = await r.json()
      setConvId(conv.id)
      sendWithId(text, conv.id)
    } else {
      sendWithId(text, convId)
    }
  }

  const sendWithId = async (text, cid) => {
    setMessages(p => [...p, { role: 'user', content: text }])
    setStreaming(true)
    setStreamContent('')

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    socket.emit('stream-chat', { messages: [...history, { role: 'user', content: text }], model, convId: cid })
  }

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return (
    <div className="chat-view">
      <div className="chat-messages">
        {messages.length === 0 && !streaming && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h2>AI Dev Agent</h2>
            <p>Ask me to solve issues, write code, plan projects, research solutions...</p>
            <div className="suggestions">
              {['Fix the bug in my GitHub issue #1', 'Write a REST API in Node.js', 'Plan a microservices architecture', 'Review my code for security issues'].map(s => (
                <button key={s} className="suggestion" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div className="message-avatar">{m.role === 'user' ? '👤' : '⚡'}</div>
            <div className="message-body">
              <ReactMarkdown components={{
                code({ inline, className, children }) {
                  const lang = /language-(\w+)/.exec(className || '')?.[1]
                  return !inline && lang ? (
                    <SyntaxHighlighter style={oneDark} language={lang} PreTag="div">{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                  ) : <code className="inline-code">{children}</code>
                }
              }}>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {streaming && (
          <div className="message assistant">
            <div className="message-avatar">⚡</div>
            <div className="message-body">
              <ReactMarkdown>{streamContent || '...'}</ReactMarkdown>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            className="chat-textarea"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask anything... (Shift+Enter for newline)"
            rows={1}
            disabled={streaming}
          />
          <button className={`send-btn ${streaming ? 'loading' : ''}`} onClick={send} disabled={streaming}>
            {streaming ? '⏳' : '➤'}
          </button>
        </div>
        <div className="chat-footer">Model: <strong>{model}</strong> · Press Enter to send</div>
      </div>
    </div>
  )
}
