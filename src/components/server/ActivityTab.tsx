import { useEffect, useState, useCallback } from 'react'
import { Activity as ActivityIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatRelative } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import type { ServerRecord, ActivityRecord } from '@/types'

export default function ActivityTab({ server }: { server: ServerRecord }) {
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('activity')
      .select('*')
      .eq('server_id', server.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setActivities((data as ActivityRecord[]) || [])
    setLoading(false)
  }, [server.id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`activity-${server.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter: `server_id=eq.${server.id}` }, () => {
        load()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [server.id, load])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  if (activities.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <ActivityIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <Card key={activity.id}>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary/40" />
                <div>
                  <p className="text-sm font-medium capitalize">{activity.action.replace(/_/g, ' ')}</p>
                  {activity.details && <p className="text-xs text-muted-foreground mt-0.5">{activity.details}</p>}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{formatRelative(activity.created_at)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
