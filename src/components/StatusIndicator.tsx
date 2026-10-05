import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface NodeStatus {
  online: boolean
  name: string | null
  totalServers: number
  availableRamMb: number
}

export default function StatusIndicator() {
  const [status, setStatus] = useState<NodeStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      const { data } = await supabase
        .from('compute_nodes')
        .select('name,status,total_servers,available_ram_mb')
        .eq('status', 'online')
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        setStatus({
          online: true,
          name: data.name,
          totalServers: data.total_servers ?? 0,
          availableRamMb: data.available_ram_mb ?? 0,
        })
      } else {
        setStatus({ online: false, name: null, totalServers: 0, availableRamMb: 0 })
      }
      setLoading(false)
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1.5 text-sm backdrop-blur-sm">
      <span className={cn(
        'relative flex h-2 w-2',
      )}>
        <span className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
          loading ? 'bg-muted-foreground' : status?.online ? 'bg-success' : 'bg-warning'
        )} />
        <span className={cn(
          'relative inline-flex rounded-full h-2 w-2',
          loading ? 'bg-muted-foreground' : status?.online ? 'bg-success' : 'bg-warning'
        )} />
      </span>
      <span className="text-muted-foreground">
        {loading ? 'Checking infrastructure...' : status?.online ? (
          <>Infrastructure Online — {status.availableRamMb >= 1024 ? `${(status.availableRamMb / 1024).toFixed(1)} GB RAM available` : `${status.availableRamMb} MB RAM available`}</>
        ) : (
          'Awaiting compute node connection'
        )}
      </span>
    </div>
  )
}
