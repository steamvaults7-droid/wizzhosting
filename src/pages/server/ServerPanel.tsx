import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronLeft, Play, Square, RotateCw, Loader2, Copy,
  Users, Clock, Cpu, MemoryStick, HardDrive, Wifi
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn, formatDuration, copyToClipboard } from '@/lib/utils'
import type { ServerRecord, ServerStatus } from '@/types'
import OverviewTab from '@/components/server/OverviewTab'
import ConsoleTab from '@/components/server/ConsoleTab'
import FilesTab from '@/components/server/FilesTab'
import PlayersTab from '@/components/server/PlayersTab'
import SettingsTab from '@/components/server/SettingsTab'
import BackupsTab from '@/components/server/BackupsTab'
import SchedulesTab from '@/components/server/SchedulesTab'
import ActivityTab from '@/components/server/ActivityTab'
import NetworkingTab from '@/components/server/NetworkingTab'
import PluginsTab from '@/components/server/PluginsTab'
import WorldTab from '@/components/server/WorldTab'

const STATUS_CONFIG: Record<ServerStatus, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' | 'default'; dot: string }> = {
  online: { label: 'Online', variant: 'success', dot: 'bg-success' },
  offline: { label: 'Offline', variant: 'secondary', dot: 'bg-muted-foreground' },
  starting: { label: 'Starting', variant: 'warning', dot: 'bg-warning animate-pulse' },
  stopping: { label: 'Stopping', variant: 'warning', dot: 'bg-warning animate-pulse' },
  sleeping: { label: 'Sleeping', variant: 'default', dot: 'bg-primary/50' },
  error: { label: 'Error', variant: 'destructive', dot: 'bg-destructive' },
  creating: { label: 'Creating', variant: 'warning', dot: 'bg-warning animate-pulse' },
}

export default function ServerPanel() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const toast = useToast()
  const [server, setServer] = useState<ServerRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const loadServer = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      toast('error', 'Failed to load server', error.message)
      return
    }
    setServer(data as ServerRecord)
    setLoading(false)
  }, [id, toast])

  useEffect(() => {
    loadServer()
    const interval = setInterval(loadServer, 5000)
    return () => clearInterval(interval)
  }, [loadServer])

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`server-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'servers', filter: `id=eq.${id}` }, (payload) => {
        setServer(payload.new as ServerRecord)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function handleAction(action: 'start' | 'stop' | 'restart') {
    if (!server) return
    setActionLoading(true)
    try {
      // Check if node is online before any action
      const { data: nodeData } = await supabase
        .from('compute_nodes')
        .select('id, status, last_seen_at')
        .eq('id', server.node_id)
        .maybeSingle()

      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
      if (!nodeData || nodeData.status !== 'online' || (nodeData.last_seen_at && nodeData.last_seen_at < thirtySecondsAgo)) {
        toast('warning', 'Node agent offline', 'Start the node agent on your computer to manage servers.')
        return
      }

      // Restart = stop first, the agent will restart automatically
      const newStatus: ServerStatus = action === 'start' ? 'starting' : 'stopping'
      const { error } = await supabase
        .from('servers')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', server.id)
      if (error) throw error
      await supabase.from('activity').insert({
        server_id: server.id,
        user_id: user?.id,
        action: `${action}_server`,
      })
      toast('success', `${action.charAt(0).toUpperCase() + action.slice(1)} requested`)
    } catch (err) {
      toast('error', 'Action failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setActionLoading(false)
    }
  }

  function handleCopy() {
    const addr = server?.custom_address || server?.address
    if (addr) {
      copyToClipboard(addr).then(() => toast('success', 'Address copied'))
    }
  }

  if (loading || !server) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[server.status]
  const isRunning = server.status === 'online'
  const isTransitioning = ['starting', 'stopping', 'creating'].includes(server.status)

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link to="/dashboard"><ChevronLeft className="h-4 w-4" />Dashboard</Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn('w-3 h-3 rounded-full', statusCfg.dot)} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{server.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>{server.software} {server.version}</span>
                <span>•</span>
                <span className="uppercase">{server.edition}</span>
                <Badge variant={statusCfg.variant} className="ml-1">{statusCfg.label}</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(server.status === 'offline' || server.status === 'sleeping' || server.status === 'error') && (
              <Button variant="success" onClick={() => handleAction('start')} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start
              </Button>
            )}
            {isRunning && (
              <>
                <Button variant="success" onClick={() => handleAction('restart')} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                  Restart
                </Button>
                <Button variant="destructive" onClick={() => handleAction('stop')} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                </Button>
              </>
            )}
            {isTransitioning && (
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
                {server.status === 'starting' ? 'Starting...' : server.status === 'stopping' ? 'Stopping...' : 'Creating...'}
              </Button>
            )}
          </div>
        </div>

        {/* Address bar */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Server Address</p>
            <p className="font-mono text-sm">
              {server.custom_address || server.address || (server.node_id ? 'Address pending — start the server' : 'No compute node connected')}
            </p>
          </div>
          {(server.custom_address || server.address) && (
            <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-4 text-sm border-l border-border pl-4">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{server.players_online}/{server.max_players}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{server.uptime_seconds > 0 ? formatDuration(server.uptime_seconds) : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto scrollbar-thin">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="console">Console</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            {server.software !== 'vanilla' && server.software !== 'bedrock' && (
              <TabsTrigger value="plugins">
                {['fabric', 'forge', 'neoforge'].includes(server.software) ? 'Mods' : 'Plugins'}
              </TabsTrigger>
            )}
            <TabsTrigger value="world">World</TabsTrigger>
            <TabsTrigger value="backups">Backups</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="networking">Networking</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"><OverviewTab server={server} /></TabsContent>
        <TabsContent value="console"><ConsoleTab server={server} /></TabsContent>
        <TabsContent value="files"><FilesTab server={server} /></TabsContent>
        <TabsContent value="players"><PlayersTab server={server} /></TabsContent>
        <TabsContent value="plugins">
          <PluginsTab server={server} />
        </TabsContent>
        <TabsContent value="world"><WorldTab server={server} /></TabsContent>
        <TabsContent value="backups"><BackupsTab server={server} /></TabsContent>
        <TabsContent value="schedules"><SchedulesTab server={server} /></TabsContent>
        <TabsContent value="networking"><NetworkingTab server={server} /></TabsContent>
        <TabsContent value="settings"><SettingsTab server={server} /></TabsContent>
        <TabsContent value="activity"><ActivityTab server={server} /></TabsContent>
      </Tabs>
    </div>
  )
}
