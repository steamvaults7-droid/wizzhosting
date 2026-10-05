import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Clock, Loader2, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@/components/ui/select'
import { formatRelative } from '@/lib/utils'
import type { ServerRecord, ScheduleRecord } from '@/types'

const ACTIONS = [
  { value: 'start', label: 'Start Server' },
  { value: 'stop', label: 'Stop Server' },
  { value: 'restart', label: 'Restart Server' },
  { value: 'backup', label: 'Create Backup' },
  { value: 'command', label: 'Run Command' },
]

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 4 AM', value: '0 4 * * *' },
  { label: 'Weekly on Sunday', value: '0 0 * * 0' },
  { label: 'Custom', value: 'custom' },
]

export default function SchedulesTab({ server }: { server: ServerRecord }) {
  const toast = useToast()
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showDelete, setShowDelete] = useState<ScheduleRecord | null>(null)
  const [name, setName] = useState('')
  const [action, setAction] = useState<string>('restart')
  const [cronPreset, setCronPreset] = useState('0 4 * * *')
  const [customCron, setCustomCron] = useState('')
  const [command, setCommand] = useState('')

  const loadSchedules = useCallback(async () => {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('server_id', server.id)
      .order('created_at', { ascending: false })
    setSchedules((data as ScheduleRecord[]) || [])
    setLoading(false)
  }, [server.id])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  async function createSchedule() {
    const cron = cronPreset === 'custom' ? customCron : cronPreset
    if (!cron) {
      toast('error', 'Invalid schedule', 'Please select or enter a cron expression')
      return
    }
    const { error } = await supabase.from('schedules').insert({
      server_id: server.id,
      name: name.trim() || `${action} schedule`,
      action: action as ScheduleRecord['action'],
      cron,
      command: action === 'command' ? command : null,
      enabled: true,
    })
    if (error) {
      toast('error', 'Failed to create schedule', error.message)
    } else {
      toast('success', 'Schedule created')
      setShowCreate(false)
      setName('')
      setCommand('')
      loadSchedules()
    }
  }

  async function toggleSchedule(schedule: ScheduleRecord) {
    await supabase.from('schedules').update({ enabled: !schedule.enabled }).eq('id', schedule.id)
    loadSchedules()
  }

  async function deleteSchedule() {
    if (!showDelete) return
    await supabase.from('schedules').delete().eq('id', showDelete.id)
    toast('success', 'Schedule deleted')
    setShowDelete(null)
    loadSchedules()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Schedules</h3>
          <p className="text-sm text-muted-foreground">Automate server tasks</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />Add Schedule
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : schedules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No schedules yet. Automate restarts, backups, and commands.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{schedule.name}</p>
                        {schedule.enabled ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Disabled</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ACTIONS.find((a) => a.value === schedule.action)?.label}
                        {schedule.command && `: ${schedule.command}`}
                        {' • '}<code className="text-xs">{schedule.cron}</code>
                      </p>
                      {schedule.last_run_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">Last run: {formatRelative(schedule.last_run_at)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={schedule.enabled} onCheckedChange={() => toggleSchedule(schedule)} />
                    <Button size="sm" variant="ghost" onClick={() => setShowDelete(schedule)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Daily restart" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {action === 'command' && (
              <div className="space-y-2">
                <Label>Command</Label>
                <Input placeholder="say Server restarting soon..." value={command} onChange={(e) => setCommand(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Schedule</Label>
              <Select value={cronPreset} onValueChange={setCronPreset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {cronPreset === 'custom' && (
              <div className="space-y-2">
                <Label>Cron expression</Label>
                <Input placeholder="0 4 * * *" value={customCron} onChange={(e) => setCustomCron(e.target.value)} />
                <p className="text-xs text-muted-foreground">Format: minute hour day month weekday</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createSchedule}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!showDelete} onOpenChange={(v) => !v && setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete schedule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{showDelete?.name} will be permanently deleted.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteSchedule}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
