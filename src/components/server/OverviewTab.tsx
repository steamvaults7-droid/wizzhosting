import { Cpu, MemoryStick, HardDrive, Wifi, Users, Clock, Activity, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatDuration, formatBytes } from '@/lib/utils'
import type { ServerRecord } from '@/types'

export default function OverviewTab({ server }: { server: ServerRecord }) {
  const isRunning = server.status === 'online'

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {!server.node_id && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">No compute node connected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start the node agent on your computer to launch and manage this server. See the setup guide.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Players</span>
            </div>
            <p className="text-2xl font-bold">{server.players_online}<span className="text-sm text-muted-foreground">/{server.max_players}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Uptime</span>
            </div>
            <p className="text-2xl font-bold">{isRunning ? formatDuration(server.uptime_seconds) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">CPU</span>
            </div>
            <p className="text-2xl font-bold">{Number(server.cpu_usage).toFixed(0)}<span className="text-sm text-muted-foreground">%</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <MemoryStick className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">RAM</span>
            </div>
            <p className="text-2xl font-bold">{server.ram_usage_mb}<span className="text-sm text-muted-foreground">/{server.ram_limit_mb}MB</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Resource graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" />CPU Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-bold">{Number(server.cpu_usage).toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground">Limit: {server.cpu_limit_percent}%</span>
            </div>
            <Progress value={Number(server.cpu_usage)} indicatorClassName="bg-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><MemoryStick className="h-4 w-4 text-primary" />RAM Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-bold">{server.ram_usage_mb} MB</span>
              <span className="text-sm text-muted-foreground">of {server.ram_limit_mb} MB</span>
            </div>
            <Progress value={(server.ram_usage_mb / server.ram_limit_mb) * 100} indicatorClassName="bg-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><HardDrive className="h-4 w-4 text-primary" />Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-bold">{formatBytes(server.storage_usage_mb * 1024 * 1024)}</span>
              <span className="text-sm text-muted-foreground">of {formatBytes(server.storage_limit_mb * 1024 * 1024)}</span>
            </div>
            <Progress value={(server.storage_usage_mb / server.storage_limit_mb) * 100} indicatorClassName="bg-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Wifi className="h-4 w-4 text-primary" />Network</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Inbound</p>
                <p className="text-2xl font-bold">{server.network_in_kbps} <span className="text-xs text-muted-foreground">KB/s</span></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outbound</p>
                <p className="text-2xl font-bold">{server.network_out_kbps} <span className="text-xs text-muted-foreground">KB/s</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Server info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Server Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Edition</p>
              <p className="font-medium capitalize">{server.edition}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Version</p>
              <p className="font-medium">{server.version}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Software</p>
              <p className="font-medium capitalize">{server.software}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Port</p>
              <p className="font-medium">{server.port ?? 'Not allocated'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">EULA</p>
              <p className="font-medium">{server.eula_accepted ? 'Accepted' : 'Not accepted'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sleep mode</p>
              <p className="font-medium">{server.sleep_enabled ? `${server.sleep_timeout_minutes} min idle` : 'Disabled'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
