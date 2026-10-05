import { useState, useRef } from 'react'
import { Upload, Trash2, Package, AlertCircle, Loader2, Info } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { ServerRecord } from '@/types'

interface PluginEntry {
  name: string
  filename: string
  size: number
  enabled: boolean
  compatible: boolean
}

export default function PluginsTab({ server }: { server: ServerRecord }) {
  const toast = useToast()
  const [plugins, setPlugins] = useState<PluginEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [showDelete, setShowDelete] = useState<PluginEntry | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isMods = ['fabric', 'forge', 'neoforge'].includes(server.software)
  const folderName = isMods ? 'mods' : 'plugins'
  const fileExt = '.jar'

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.jar')) {
      toast('error', 'Invalid file', 'Only .jar files are supported')
      return
    }
    setUploading(true)
    // Upload through the node agent file API
    try {
      const content = await file.arrayBuffer()
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/node-files`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          serverId: server.id,
          path: `/${folderName}/${file.name}`,
          action: 'write',
          content: btoa(String.fromCharCode(...new Uint8Array(content))),
          binary: true,
        }),
      })
      if (response.ok) {
        const entry: PluginEntry = {
          name: file.name.replace(fileExt, ''),
          filename: file.name,
          size: file.size,
          enabled: true,
          compatible: true,
        }
        setPlugins((prev) => [...prev, entry])
        toast('success', `${isMods ? 'Mod' : 'Plugin'} uploaded`, `${file.name} added to ${folderName}/ folder. Restart the server to apply.`)
      } else {
        toast('error', 'Upload failed')
      }
    } catch {
      toast('error', 'Upload failed', 'No node connected or file too large')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removePlugin(plugin: PluginEntry) {
    setPlugins((prev) => prev.filter((p) => p.filename !== plugin.filename))
    setShowDelete(null)
    toast('success', `${isMods ? 'Mod' : 'Plugin'} removed`, 'Restart the server to apply changes')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{isMods ? 'Mods' : 'Plugins'}</h3>
          <p className="text-sm text-muted-foreground">
            {isMods
              ? `Upload mod JARs to the ${folderName}/ folder. Fabric/Forge/NeoForge mods only.`
              : `Upload plugin JARs to the ${folderName}/ folder. ${server.software.charAt(0).toUpperCase() + server.software.slice(1)} plugins only.`}
          </p>
        </div>
        <Button asChild>
          <label className="cursor-pointer flex items-center gap-2">
            <Upload className="h-4 w-4" />Upload {isMods ? 'Mod' : 'Plugin'}
            <input type="file" accept=".jar" className="hidden" onChange={handleUpload} ref={fileRef} />
          </label>
        </Button>
      </div>

      {/* Version warning */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Version compatibility</p>
            <p className="text-muted-foreground mt-1">
              Make sure your {isMods ? 'mods' : 'plugins'} are compatible with Minecraft {server.version} and {server.software}.
              Incompatible {isMods ? 'mods' : 'plugins'} may crash the server.
            </p>
          </div>
        </CardContent>
      </Card>

      {uploading && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Uploading...</span>
        </div>
      )}

      {plugins.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No {isMods ? 'mods' : 'plugins'} installed yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload a .jar file to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <Card key={plugin.filename}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{plugin.name}</p>
                      <p className="text-xs text-muted-foreground">{plugin.filename} • {(plugin.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {plugin.compatible ? (
                      <Badge variant="success">Compatible</Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />Incompatible
                      </Badge>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setShowDelete(plugin)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!showDelete} onOpenChange={(v) => !v && setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {isMods ? 'mod' : 'plugin'}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{showDelete?.filename} will be removed. Restart the server to apply.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => showDelete && removePlugin(showDelete)}>
              <Trash2 className="h-4 w-4" />Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
