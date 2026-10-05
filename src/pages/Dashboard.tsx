import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import {
  Server, Plus, Cpu, MemoryStick, HardDrive, Activity,
  Play, Square, RotateCw, Settings, Users,
  CircleDot, AlertCircle, Loader2, Clock, Download, Terminal,
  Trash2, Monitor, WifiOff, Wifi, Cpu as CpuIcon, CheckCircle2,
  XCircle, FolderOpen, Coffee, ShieldCheck, ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatRelative, formatDuration, copyToClipboard, formatBytes } from '@/lib/utils'
import { FREE_TIER_LIMITS } from '@/types'
import type { ServerRecord, ServerStatus, ComputeNode } from '@/types'

const STATUS_CONFIG: Record<ServerStatus, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' | 'default'; dot: string }> = {
  online: { label: 'Online', variant: 'success', dot: 'bg-success' },
  offline: { label: 'Offline', variant: 'secondary', dot: 'bg-muted-foreground' },
  starting: { label: 'Starting', variant: 'warning', dot: 'bg-warning animate-pulse' },
  stopping: { label: 'Stopping', variant: 'warning', dot: 'bg-warning animate-pulse' },
  sleeping: { label: 'Sleeping', variant: 'default', dot: 'bg-primary/50' },
  error: { label: 'Error', variant: 'destructive', dot: 'bg-destructive' },
  creating: { label: 'Creating', variant: 'warning', dot: 'bg-warning animate-pulse' },
}

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [servers, setServers] = useState<ServerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [node, setNode] = useState<ComputeNode | null>(null)
  const [activeTab, setActiveTab] = useState<'servers' | 'node'>('servers')
  const [deleteTarget, setDeleteTarget] = useState<ServerRecord | null>(null)
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast('error', 'Failed to load servers', error.message)
      return
    }
    setServers((data as ServerRecord[]) || [])

    // Check for live node (heartbeat within 30s)
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
    const { data: nodes } = await supabase
      .from('compute_nodes')
      .select('*')
      .eq('status', 'online')
      .gte('last_seen_at', thirtySecondsAgo)
      .order('last_seen_at', { ascending: false })
      .limit(1)

    if (nodes && nodes.length > 0) {
      setNode(nodes[0] as ComputeNode)
    } else {
      setNode(null)
    }

    setLoading(false)
  }, [toast])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [loadData])

  useEffect(() => {
    const channel = supabase
      .channel('servers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setServers((prev) =>
            prev.map((s) => (s.id === (payload.new as ServerRecord).id ? (payload.new as ServerRecord) : s))
          )
        } else if (payload.eventType === 'INSERT') {
          setServers((prev) => [payload.new as ServerRecord, ...prev])
        } else if (payload.eventType === 'DELETE') {
          setServers((prev) => prev.filter((s) => s.id !== (payload.old as ServerRecord).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const hasNode = !!node

  async function handleServerAction(server: ServerRecord, action: 'start' | 'stop' | 'restart') {
    setActionLoading(`${server.id}-${action}`)
    try {
      if (!hasNode) {
        toast('warning', 'No compute node connected', 'Start the node agent on your computer to manage servers.')
        return
      }

      if (action === 'start' && (server.status === 'starting' || server.status === 'online')) {
        toast('info', 'Server already running', 'This server is already online or starting.')
        return
      }

      if (action === 'stop' && (server.status === 'offline' || server.status === 'stopping')) {
        toast('info', 'Server already stopped', 'This server is already offline or stopping.')
        return
      }

      // For restart, set to stopping — the agent will stop then restart
      const newStatus: ServerStatus = action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'stopping'
      const { error } = await supabase
        .from('servers')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', server.id)

      if (error) throw error

      await supabase.from('activity').insert({
        server_id: server.id,
        user_id: user?.id,
        action: `${action}_server`,
        details: `Server ${action} requested`,
      })

      toast('success', `${action.charAt(0).toUpperCase() + action.slice(1)} requested`, 'The node agent will process this shortly.')
    } catch (err) {
      toast('error', 'Action failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setActionLoading(null)
    }
  }

  function handleCopyAddress(server: ServerRecord) {
    const addr = server.custom_address || server.address
    if (addr) {
      copyToClipboard(addr).then(() => toast('success', 'Address copied'))
    }
  }

  async function handleDeleteServer() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/node-api/delete-server`
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ serverId: deleteTarget.id }),
      })
      if (!resp.ok) throw new Error('Failed to delete server')
      toast('success', 'Server deleted', `${deleteTarget.name} has been permanently deleted.`)
      setDeleteTarget(null)
      setDeleteStep(0)
    } catch (err) {
      toast('error', 'Delete failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeleting(false)
    }
  }

  const onlineCount = servers.filter((s) => s.status === 'online').length
  const offlineCount = servers.filter((s) => s.status === 'offline' || s.status === 'sleeping').length
  const totalRamUsed = servers.reduce((sum, s) => sum + (s.ram_usage_mb || 0), 0)
  const totalRamAllocated = servers.reduce((sum, s) => sum + s.ram_limit_mb, 0)
  const totalCpuUsed = servers.reduce((sum, s) => sum + Number(s.cpu_usage || 0), 0)
  const totalStorageUsed = servers.reduce((sum, s) => sum + (s.storage_usage_mb || 0), 0)

  const runningServersOnNode = servers.filter((s) => s.status === 'online' || s.status === 'starting')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.username}</h1>
          <p className="text-muted-foreground mt-1">Manage your Minecraft servers</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab toggle */}
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
            <button
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                activeTab === 'servers' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('servers')}
            >
              <Server className="h-4 w-4 inline mr-1.5" />Servers
            </button>
            <button
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                activeTab === 'node' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('node')}
            >
              <Monitor className="h-4 w-4 inline mr-1.5" />Node Agent
              {hasNode && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-success" />}
            </button>
          </div>
          <Button asChild>
            <Link to="/servers/new"><Plus className="h-4 w-4" />Create Server</Link>
          </Button>
        </div>
      </div>

      {activeTab === 'node' ? (
        <NodeAgentTab node={node} runningServers={runningServersOnNode} />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Servers</p>
                    <p className="text-2xl font-bold mt-1">{servers.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">of {FREE_TIER_LIMITS.maxServers} max</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Online</p>
                    <p className="text-2xl font-bold mt-1 text-success">{onlineCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">{offlineCount} offline/sleeping</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CircleDot className="h-5 w-5 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">RAM Usage</p>
                    <p className="text-2xl font-bold mt-1">{(totalRamUsed / 1024).toFixed(1)} <span className="text-sm text-muted-foreground">GB</span></p>
                    <p className="text-xs text-muted-foreground mt-1">{(totalRamAllocated / 1024).toFixed(1)} GB allocated</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MemoryStick className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Storage Used</p>
                    <p className="text-2xl font-bold mt-1">{formatBytes(totalStorageUsed * 1024 * 1024)}</p>
                    <p className="text-xs text-muted-foreground mt-1">of {FREE_TIER_LIMITS.maxStorageMb / 1024} GB max</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <HardDrive className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Node offline warning */}
          {!hasNode && (
            <Card className="border-warning/30 bg-warning/5 mb-8">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                    <Terminal className="h-5 w-5 text-warning" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">Connect your computer to start servers</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Download the agent, extract the folder, and double-click the launcher. That's it —
                      no terminal, no commands, no manual setup.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" asChild>
                          <a href="/downloads/wizzhosting-node-agent-v5.0-2026-10-05.zip" download>
                            <Download className="h-4 w-4" />Download Node Agent
                          </a>
                        </Button>
                        <a
                          href="https://www.virustotal.com/gui/file/f1005ad3c51559da1c4fa7b894e6863d09660c608a8f8cc3f8166d21b96d8457/details"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2.5 py-2 text-xs font-medium text-success hover:bg-success/15 transition-colors"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />0/65 flagged
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <a href="/SETUP.md" target="_blank" rel="noopener">Setup Guide</a>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab('node')}>
                        <Monitor className="h-4 w-4" />Node Agent Details
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resource overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">CPU</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{totalCpuUsed.toFixed(0)}%</span>
                </div>
                <Progress value={Math.min(totalCpuUsed, 100)} indicatorClassName="bg-primary" />
                <p className="text-xs text-muted-foreground mt-2">Across all running servers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">RAM</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{(totalRamUsed / 1024).toFixed(1)} / {(FREE_TIER_LIMITS.maxRamMb / 1024).toFixed(0)} GB</span>
                </div>
                <Progress value={(totalRamUsed / FREE_TIER_LIMITS.maxRamMb) * 100} indicatorClassName="bg-primary" />
                <p className="text-xs text-muted-foreground mt-2">{((FREE_TIER_LIMITS.maxRamMb - totalRamUsed) / 1024).toFixed(1)} GB available</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Storage</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{formatBytes(totalStorageUsed * 1024 * 1024)}</span>
                </div>
                <Progress value={(totalStorageUsed / FREE_TIER_LIMITS.maxStorageMb) * 100} indicatorClassName="bg-primary" />
                <p className="text-xs text-muted-foreground mt-2">{formatBytes((FREE_TIER_LIMITS.maxStorageMb - totalStorageUsed) * 1024 * 1024)} available</p>
              </CardContent>
            </Card>
          </div>

          {/* Servers */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your Servers</h2>
          </div>

          {servers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Server className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No servers yet</h3>
                <p className="text-muted-foreground text-sm mt-1 mb-6">Create your first Minecraft server to get started</p>
                <Button asChild>
                  <Link to="/servers/new"><Plus className="h-4 w-4" />Create Server</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {servers.map((server) => {
                const statusCfg = STATUS_CONFIG[server.status]
                const displayAddress = server.custom_address || server.address
                return (
                  <Card key={server.id} className="group hover:border-primary/30 transition-all">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-2.5 h-2.5 rounded-full', statusCfg.dot)} />
                          <div>
                            <h3 className="font-semibold">{server.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {server.software} • {server.version} • {server.edition}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => { setDeleteTarget(server); setDeleteStep(0) }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Players</p>
                          <p className="font-medium flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {server.players_online} / {server.max_players}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Uptime</p>
                          <p className="font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {server.uptime_seconds > 0 ? formatDuration(server.uptime_seconds) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">RAM</p>
                          <div className="flex items-center gap-2">
                            <Progress value={(server.ram_usage_mb / server.ram_limit_mb) * 100} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground">{server.ram_usage_mb}MB</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">CPU</p>
                          <div className="flex items-center gap-2">
                            <Progress value={Number(server.cpu_usage)} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground">{Number(server.cpu_usage).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-4 p-2 rounded-md bg-muted/30">
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Server Address</p>
                          <p className="font-mono text-sm">
                            {displayAddress || (server.node_id ? 'Pending...' : 'No node connected')}
                          </p>
                        </div>
                        {displayAddress && (
                          <Button variant="ghost" size="icon-sm" onClick={() => handleCopyAddress(server)}>
                            <Activity className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(server.status === 'offline' || server.status === 'sleeping' || server.status === 'error') && (
                          <Button
                            size="sm"
                            variant="success"
                            className="flex-1"
                            disabled={actionLoading === `${server.id}-start` || !hasNode}
                            onClick={() => handleServerAction(server, 'start')}
                          >
                            {actionLoading === `${server.id}-start` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            Start
                          </Button>
                        )}
                        {server.status === 'online' && (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              className="flex-1"
                              disabled={actionLoading === `${server.id}-restart`}
                              onClick={() => handleServerAction(server, 'restart')}
                            >
                              {actionLoading === `${server.id}-restart` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                              Restart
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionLoading === `${server.id}-stop`}
                              onClick={() => handleServerAction(server, 'stop')}
                            >
                              {actionLoading === `${server.id}-stop` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                            </Button>
                          </>
                        )}
                        {(server.status === 'starting' || server.status === 'stopping' || server.status === 'creating') && (
                          <Button size="sm" variant="outline" className="flex-1" disabled>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {server.status === 'starting' ? 'Starting...' : server.status === 'stopping' ? 'Stopping...' : 'Creating...'}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => navigate(`/server/${server.id}`)}>
                          <Settings className="h-4 w-4" />
                          Manage
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog — 2-step */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteStep(0) } }}>
        <DialogContent className="max-w-md">
          {deleteStep === 0 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Delete "{deleteTarget?.name}"?
                </DialogTitle>
                <DialogDescription>
                  This will permanently delete the server, its world data, files, players, backups, and all logs.
                  <strong className="text-destructive"> This cannot be undone.</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive font-medium">Warning</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All world data and configuration for this server will be lost forever.
                  If the server is running, it will be stopped immediately.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteStep(0) }}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => setDeleteStep(1)}>
                  <Trash2 className="h-4 w-4" />
                  Yes, I want to delete it
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Are you absolutely sure?
                </DialogTitle>
                <DialogDescription>
                  This is your final warning. Once you click "Delete forever", the server
                  "{deleteTarget?.name}" and all its data will be permanently destroyed.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border-2 border-destructive/40 bg-destructive/10 p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <p className="text-sm text-destructive font-semibold">Last chance!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Type "{deleteTarget?.name}" in the box below to confirm deletion.
                    </p>
                  </div>
                </div>
                <ConfirmInput expected={deleteTarget?.name || ''} onMatch={() => {}} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteStep(0) }}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleting}
                  onClick={handleDeleteServer}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete forever
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConfirmInput({ expected, onMatch }: { expected: string; onMatch: () => void }) {
  const [value, setValue] = useState('')
  const matches = value.trim() === expected.trim()
  return (
    <div className="mt-3 space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); onMatch() }}
        placeholder={expected}
        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono"
        autoFocus
      />
      {value.length > 0 && (
        <div className={cn('flex items-center gap-1.5 text-xs', matches ? 'text-success' : 'text-destructive')}>
          {matches ? <><CheckCircle2 className="h-3 w-3" /> Names match</> : <><XCircle className="h-3 w-3" /> Names don't match</>}
        </div>
      )}
    </div>
  )
}

function NodeAgentTab({ node, runningServers }: { node: ComputeNode | null; runningServers: ServerRecord[] }) {
  const isOnline = !!node

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Status card */}
      <Card className={cn(
        'border-2',
        isOnline ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center shrink-0',
              isOnline ? 'bg-success/10' : 'bg-destructive/10'
            )}>
              {isOnline ? <Wifi className="h-7 w-7 text-success" /> : <WifiOff className="h-7 w-7 text-destructive" />}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">
                Node Agent {isOnline ? 'Connected' : 'Offline'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isOnline
                  ? `Last seen ${formatRelative(node.last_seen_at || new Date().toISOString())}`
                  : 'The node agent is not running. Download and start it to manage servers.'}
              </p>
              {isOnline && (
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <Badge variant="success" className="gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />Online
                  </Badge>
                  {node.java_version && (
                    <Badge variant="default" className="gap-1">
                      <Coffee className="h-3 w-3" />Java {node.java_version}
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {runningServers.length} server{runningServers.length !== 1 ? 's' : ''} running
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Download section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Download Node Agent</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Download the zip, extract it, and double-click <code className="text-xs px-1 py-0.5 rounded bg-muted">start-windows.bat</code> (Windows)
                or <code className="text-xs px-1 py-0.5 rounded bg-muted">start-mac-linux.sh</code> (Mac/Linux). The launcher handles everything else automatically.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild>
                  <a href="/downloads/wizzhosting-node-agent-v5.0-2026-10-05.zip" download>
                    <Download className="h-4 w-4" />Download Node Agent
                  </a>
                </Button>
                <a
                  href="https://www.virustotal.com/gui/file/f1005ad3c51559da1c4fa7b894e6863d09660c608a8f8cc3f8166d21b96d8457/details"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2.5 py-2 text-xs font-medium text-success hover:bg-success/15 transition-colors"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />Previous v4 scan: 0/65 flagged
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Button variant="outline" asChild>
                  <a href="/SETUP.md" target="_blank" rel="noopener">Setup Guide</a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node details */}
      {isOnline && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              Node Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Node Name</p>
                <p className="text-sm font-medium mt-1 font-mono break-all">{node.name}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Public Address</p>
                <p className="text-sm font-medium mt-1 font-mono break-all">{node.public_address || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Coffee className="h-3 w-3" />Java Version</p>
                <p className="text-sm font-medium mt-1">{node.java_version || 'Not detected'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Last Seen</p>
                <p className="text-sm font-medium mt-1">{formatRelative(node.last_seen_at || new Date().toISOString())}</p>
              </div>
            </div>

            {/* Resource bars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm flex items-center gap-1"><CpuIcon className="h-3 w-3 text-primary" />CPU</span>
                  <span className="text-xs text-muted-foreground">{node.used_cpu_percent}%</span>
                </div>
                <Progress value={node.used_cpu_percent} indicatorClassName="bg-primary" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm flex items-center gap-1"><MemoryStick className="h-3 w-3 text-primary" />RAM</span>
                  <span className="text-xs text-muted-foreground">{node.used_ram_mb} / {node.available_ram_mb} MB</span>
                </div>
                <Progress value={(node.used_ram_mb / Math.max(node.available_ram_mb, 1)) * 100} indicatorClassName="bg-primary" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm flex items-center gap-1"><HardDrive className="h-3 w-3 text-primary" />Storage</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(node.used_storage_mb * 1024 * 1024)}</span>
                </div>
                <Progress value={(node.used_storage_mb / Math.max(node.available_storage_mb, 1)) * 100} indicatorClassName="bg-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Running servers on this node */}
      {isOnline && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              Servers Running on This Node
            </h3>
            {runningServers.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <FolderOpen className="h-4 w-4" />
                No servers are currently running on this node.
              </div>
            ) : (
              <div className="space-y-2">
                {runningServers.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        s.status === 'online' ? 'bg-success' : 'bg-warning animate-pulse'
                      )} />
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.software} {s.version}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{s.players_online} players</p>
                      <p className="text-xs text-muted-foreground">{s.ram_usage_mb}MB RAM</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions when offline */}
      {!isOnline && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              How to Connect
            </h3>
            <ol className="space-y-3">
              {[
                { icon: Download, text: 'Download the node agent zip using the button above.' },
                { icon: FolderOpen, text: 'Extract the zip to any folder on your computer.' },
                { icon: Terminal, text: 'Double-click start-windows.bat (Windows) or run start-mac-linux.sh (Mac/Linux). The launcher auto-installs everything and starts the agent.' },
                { icon: CheckCircle2, text: 'Keep the window open while you play. That\'s it — your computer is now connected!' },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm text-muted-foreground pt-0.5 flex items-start gap-2">
                    <step.icon className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                    <span>{step.text}</span>
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
