import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import Chat from './components/Chat'
import Sidebar from './components/Sidebar'
import Agent from './components/Agent'
import GitHub from './components/GitHub'
import Settings from './components/Settings'
import MCP from './components/MCP'
import './App.css'

export const socket = io('/', { path: '/socket.io' })
export const API = '/api'

export default function App() {
  const [view, setView] = useState('chat')
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet')
  const [convId, setConvId] = useState(null)
  const [models, setModels] = useState({})
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    fetch(`${API}/models`).then(r => r.json()).then(d => setModels(d.presets || {}))
    return () => socket.off()
  }, [])

  const views = {
    chat: <Chat model={model} convId={convId} setConvId={setConvId} />,
    agent: <Agent model={model} />,
    github: <GitHub model={model} />,
    mcp: <MCP />,
    settings: <Settings currentModel={model} setModel={setModel} models={models} />
  }

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} model={model} setModel={setModel} models={models} connected={connected} convId={convId} setConvId={setConvId} />
      <main className="main">{views[view]}</main>
    </div>
  )
}
