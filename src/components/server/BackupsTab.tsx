import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Download, Upload, RotateCcw, Loader2, Archive, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { formatBytes, formatRelative } from '@/lib/utils'
import type { ServerRecord, BackupRecord } from '@/types'

export default function BackupsTab({ server }: { server: ServerRecord }) {
  const toast = useToast()
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [backupName, setBackupName] = useState('')
  const [showRestore, setShowRestore] = useState<BackupRecord | null>(null)
  const [showDelete, setShowDelete] = useState<BackupRecord | null>(null)

  const loadBackups = useCallback(async () => {
    const { data, error } = await supabase
      .from('backups')
      .select('*')
      .eq('server_id', server.id)
      .order('created_at', { ascending: false })
    if (error) {
      toast('error', 'Failed to load backups')
      return
    }
    setBackups((data as BackupRecord[]) || [])
    setLoading(false)
  }, [server.id, toast])

  useEffect(() => {
    loadBackups()
    const interval = setInterval(loadBackups, 15000)
    return () => clearInterval(interval)
  }, [loadBackups])

  async function createBackup() {
    setCreating(true)
    const name = backupName.trim() || `backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`
    const { data, error } = await supabase
      .from('backups')
      .insert({
        server_id: server.id,
        name,
        status: 'creating',
      })
      .select()
      .single()

    if (error) {
      toast('error', 'Failed to create backup', error.message)
    } else {
      toast('success', 'Backup started', 'The node agent will create the archive')
      setShowCreate(false)
      setBackupName('')
      await supabase.from('activity').insert({
        server_id: server.id,
        action: 'create_backup',
        details: name,
      })
      loadBackups()
    }
    setCreating(false)
  }

  async function restoreBackup(backup: BackupRecord) {
    await supabase.from('backups').update({ status: 'restoring' }).eq('id', backup.id)
    await supabase.from('activity').insert({
      server_id: server.id,
      action: 'restore_backup',
      details: backup.name,
    })
    toast('success', 'Restore started', 'The node agent will restore the world')
    setShowRestore(null)
    loadBackups()
  }

  async function deleteBackup(backup: BackupRecord) {
    const { error } = await supabase.from('backups').delete().eq('id', backup.id)
    if (error) {
      toast('error', 'Failed to delete')
    } else {
      toast('success', 'Backup deleted')
      setShowDelete(null)
      loadBackups()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Backups</h3>
          <p className="text-sm text-muted-foreground">{backups.length} backups • {formatBytes(backups.reduce((s, b) => s + b.size_bytes, 0))} total</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />Create Backup
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : backups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Archive className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No backups yet. Create one to protect your world.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => (
            <Card key={backup.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Archive className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{backup.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatRelative(backup.created_at)}</span>
                        <span>{formatBytes(backup.size_bytes)}</span>
                        {backup.status === 'creating' && <Badge variant="warning">Creating...</Badge>}
                        {backup.status === 'restoring' && <Badge variant="warning">Restoring...</Badge>}
                        {backup.status === 'failed' && <Badge variant="destructive">Failed</Badge>}
                      </div>
                    </div>
                  </div>
                  {backup.status === 'complete' && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setShowRestore(backup)}>
                        <RotateCcw className="h-3 w-3" />Restore
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowDelete(backup)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  )}
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
            <DialogTitle>Create backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Backup name (optional)</label>
            <input
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="my-world-backup"
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createBackup} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <Dialog open={!!showRestore} onOpenChange={(v) => !v && setShowRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore backup?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will replace the current world with <strong>{showRestore?.name}</strong>. The server will be stopped during restore. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestore(null)}>Cancel</Button>
            <Button variant="warning" onClick={() => showRestore && restoreBackup(showRestore)}>
              <RotateCcw className="h-4 w-4" />Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!showDelete} onOpenChange={(v) => !v && setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete backup?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This permanently deletes {showDelete?.name}.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => showDelete && deleteBackup(showDelete)}>
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
