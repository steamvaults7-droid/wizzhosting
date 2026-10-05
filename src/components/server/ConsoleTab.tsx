import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Search, Pause, Play, Trash2, Download, Terminal,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ServerRecord, ServerLog } from '@/types'

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-muted-foreground',
  warning: 'text-warning',
  error: 'text-destructive',
  command: 'text-primary',
}

export default function ConsoleTab({ server }: { server: ServerRecord }) {
  const toast = useToast()
  const [logs, setLogs] = useState<ServerLog[]>([])
  const [command, setCommand] = useState('')
  const [paused, setPaused] = useState(false)
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('server_logs')
      .select('*')
      .eq('server_id', server.id)
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) {
      setLogs((data as ServerLog[]).reverse())
    }
  }, [server.id])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Realtime subscription for new logs
  useEffect(() => {
    const channel = supabase
      .channel(`logs-${server.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'server_logs',
        filter: `server_id=eq.${server.id}`,
      }, (payload) => {
        if (!paused) {
          setLogs((prev) => [...prev.slice(-499), payload.new as ServerLog])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [server.id, paused])

  // Auto scroll
  useEffect(() => {
    if (autoScrollRef.current && !paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, paused])

  function handleScroll() {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50
  }

  async function sendCommand() {
    if (!command.trim()) return
    const cmd = command.trim()
    setCommand('')
    setHistory((prev) => [...prev, cmd])
    setHistoryIdx(-1)

    // Insert as command log
    await supabase.from('server_logs').insert({
      server_id: server.id,
      level: 'command',
      message: `> ${cmd}`,
    })

    // The node agent picks this up and executes it
    // For now we log it — the agent will write the response
    if (server.status !== 'online') {
      toast('warning', 'Server not running', 'Commands can only be sent when the server is online')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      sendCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1)
        setHistoryIdx(newIdx)
        setCommand(history[newIdx])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx !== -1) {
        const newIdx = historyIdx + 1
        if (newIdx >= history.length) {
          setHistoryIdx(-1)
          setCommand('')
        } else {
          setHistoryIdx(newIdx)
          setCommand(history[newIdx])
        }
      }
    }
  }

  function downloadLogs() {
    const text = logs
      .map((l) => `[${new Date(l.created_at).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${server.name}-console-${Date.now()}.log`
    a.click()
    URL.revokeObjectURL(url)
    toast('success', 'Logs downloaded')
  }

  async function clearLogs() {
    await supabase.from('server_logs').delete().eq('server_id', server.id)
    setLogs([])
    toast('success', 'Console cleared')
  }

  const filteredLogs = search
    ? logs.filter((l) => l.message.toLowerCase().includes(search.toLowerCase()))
    : logs

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setPaused(!paused)}>
          {paused ? <><Play className="h-4 w-4" />Resume</> : <><Pause className="h-4 w-4" />Pause</>}
        </Button>
        <Button variant="outline" size="sm" onClick={downloadLogs}>
          <Download className="h-4 w-4" />Download
        </Button>
        <Button variant="outline" size="sm" onClick={clearLogs}>
          <Trash2 className="h-4 w-4" />Clear
        </Button>
      </div>

      {/* Console */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[400px] overflow-y-auto scrollbar-thin rounded-lg border border-border bg-black/40 p-4 font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-muted-foreground flex items-center justify-center h-full">
            <Terminal className="h-5 w-5 mr-2" />
            No console output yet. {server.status === 'online' ? 'Send a command below.' : 'Start the server to see logs.'}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className={cn('leading-relaxed whitespace-pre-wrap break-all', LEVEL_COLORS[log.level])}>
              <span className="text-muted-foreground/50 mr-2">
                {new Date(log.created_at).toLocaleTimeString()}
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>

      {/* Command input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-mono text-sm">&gt;</span>
          <Input
            placeholder={server.status === 'online' ? 'Type a command... (e.g. say Hello)' : 'Server offline — start to send commands'}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-7 font-mono"
            disabled={server.status !== 'online'}
          />
        </div>
        <Button onClick={sendCommand} disabled={!command.trim() || server.status !== 'online'}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Use ↑/↓ for command history. Commands are sent to the running Minecraft server.
      </p>
    </div>
  )
}
