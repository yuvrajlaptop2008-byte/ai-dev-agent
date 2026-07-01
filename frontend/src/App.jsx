import { useState, useEffect, createContext } from 'react'
import { io } from 'socket.io-client'
import Chat from './components/Chat'
import Sidebar from './components/Sidebar'
import Agent from './components/Agent'
import GitHub from './components/GitHub'
import Settings from './components/Settings'
import MCP from './components/MCP'
import Terminal from './components/Terminal'
import Research from './components/Research'
import VSCode from './components/VSCode'
import Contribute from './components/Contribute'
import './App.css'

export const socket = io('/', { path: '/socket.io', transports: ['websocket'] })
export const API = '/api'
export const AppCtx = createContext({})

export default function App() {
  const [view, setView] = useState('agent')
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet')
  const [convId, setConvId] = useState(null)
  const [models, setModels] = useState({ presets: {}, all: [], free: [] })
  const [connected, setConnected] = useState(false)
  const [repoCtx, setRepoCtx] = useState({ owner: 'yuvrajlaptop2008-byte', repo: '' })
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    fetch(`${API}/models`).then(r => r.json()).then(d => setModels({ presets: d.presets || {}, all: d.models || [], free: d.free || [] }))
  }, [])

  const notify = (msg, type = 'info') => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 4000) }
  const ctx = { model, setModel, models, repoCtx, setRepoCtx, notify, convId, setConvId }

  const views = { agent:<Agent/>, chat:<Chat/>, research:<Research/>, github:<GitHub/>, contribute:<Contribute/>, vscode:<VSCode/>, terminal:<Terminal/>, mcp:<MCP/>, settings:<Settings/> }
  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <Sidebar view={view} setView={setView} connected={connected} />
        <main className="main">{views[view]||views.agent}</main>
        {notification && <div className={`notification notification-${notification.type}`}>{notification.msg}</div>}
      </div>
    </AppCtx.Provider>
  )
}
