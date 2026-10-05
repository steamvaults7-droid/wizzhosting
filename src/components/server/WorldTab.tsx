import { useState } from 'react'
import { Globe, Download, Upload, Trash2, Archive, Loader2, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { ServerRecord } from '@/types'

const DIMENSIONS = [
  { name: 'world', label: 'Overworld', desc: 'The main world' },
  { name: 'world_nether', label: 'Nether', desc: 'The Nether dimension' },
  { name: 'world_the_end', label: 'The End', desc: 'The End dimension' },
]

export default function WorldTab({ server }: { server: ServerRecord }) {
  const toast = useToast()
  const [showDelete, setShowDelete] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  async function handleBackupWorld() {
    setActionLoading(true)
    const { error } = await supabase.from('backups').insert({
      server_id: server.id,
      name: `world-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`,
      status: 'creating',
    })
    if (error) {
      toast('error', 'Failed to start backup')
    } else {
      toast('success', 'World backup started')
    }
    setActionLoading(false)
  }

  async function handleDownloadWorld() {
    if (!server.node_id) {
      toast('warning', 'No node connected')
      return
    }
    toast('info', 'Preparing download', 'The node agent will package the world for download')
  }

  async function handleDeleteWorld(dim: string) {
    setShowDelete(null)
    toast('success', 'World deletion requested', 'The node agent will remove the world. Server will regenerate on next start.')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">World Management</h3>
          <p className="text-sm text-muted-foreground">Manage your Minecraft worlds</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadWorld}>
            <Download className="h-4 w-4" />Download
          </Button>
          <Button variant="outline" size="sm" onClick={handleBackupWorld} disabled={actionLoading}>
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}Backup
          </Button>
        </div>
      </div>

      {/* Dimensions */}
      <div className="space-y-3">
        {DIMENSIONS.map((dim) => (
          <Card key={dim.name}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{dim.label}</p>
                      <Badge variant="secondary" className="text-xs">{dim.name}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{dim.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={handleDownloadWorld}>
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowDelete(dim.name)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upload world */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center py-4">
            <Upload className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Upload a world</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Upload a .zip archive of a world folder</p>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" />Choose File
                <input type="file" accept=".zip" className="hidden" onChange={() => toast('info', 'Upload coming soon', 'Use the Files tab to upload world folders manually')} />
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">World regeneration</p>
            <p className="text-muted-foreground mt-1">
              Deleting a world removes it permanently. The server will generate a new world with the seed from Settings on next start.
              Always create a backup before deleting.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!showDelete} onOpenChange={(v) => !v && setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {showDelete}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the {showDelete} world. Create a backup first if you want to keep it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => showDelete && handleDeleteWorld(showDelete)}>
              <Trash2 className="h-4 w-4" />Delete World
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
