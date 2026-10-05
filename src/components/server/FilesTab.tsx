import { useState, useEffect, useCallback } from 'react'
import {
  Folder, File, ChevronRight, ChevronDown, Upload, Download,
  Trash2, FilePlus, FolderPlus, Pencil, Search, Home, Loader2,
  Save, X, AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatBytes, formatRelative } from '@/lib/utils'
import type { ServerRecord } from '@/types'

interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
}

export default function FilesTab({ server }: { server: ServerRecord }) {
  const toast = useToast()
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editPath, setEditPath] = useState('')
  const [editing, setEditing] = useState(false)
  const [showNewFile, setShowNewFile] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newName, setNewName] = useState('')
  const [showDelete, setShowDelete] = useState<FileItem | null>(null)
  const [uploadPath, setUploadPath] = useState('')

  const loadFiles = useCallback(async () => {
    if (!server.node_id) {
      setLoading(false)
      return
    }
    // File operations go through the node agent's edge function
    setLoading(true)
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/node-files`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          serverId: server.id,
          path: currentPath,
          action: 'list',
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      } else {
        setFiles([])
      }
    } catch {
      setFiles([])
    }
    setLoading(false)
  }, [server.id, server.node_id, currentPath])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  function navigateTo(path: string) {
    setCurrentPath(path)
  }

  function navigateUp() {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath('/' + parts.join('/'))
  }

  function handleClick(file: FileItem) {
    if (file.isDirectory) {
      navigateTo(file.path)
    } else {
      openEditor(file)
    }
  }

  async function openEditor(file: FileItem) {
    if (!server.node_id) return
    setEditing(true)
    setEditPath(file.path)
    setEditContent('')
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/node-files`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          serverId: server.id,
          path: file.path,
          action: 'read',
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setEditContent(data.content || '')
      }
    } catch {
      toast('error', 'Failed to read file')
    }
  }

  async function saveFile() {
    if (!server.node_id) return
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/node-files`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          serverId: server.id,
          path: editPath,
          action: 'write',
          content: editContent,
        }),
      })
      if (response.ok) {
        toast('success', 'File saved')
        setEditing(false)
        loadFiles()
      } else {
        toast('error', 'Failed to save file')
      }
    } catch {
      toast('error', 'Failed to save file')
    }
  }

  async function createItem(type: 'file' | 'folder') {
    if (!newName.trim()) return
    const fullPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/node-files`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          serverId: server.id,
          path: fullPath,
          action: type === 'folder' ? 'mkdir' : 'create',
        }),
      })
      if (response.ok) {
        toast('success', `${type === 'folder' ? 'Folder' : 'File'} created`)
        setShowNewFile(false)
        setShowNewFolder(false)
        setNewName('')
        loadFiles()
      }
    } catch {
      toast('error', 'Failed to create')
    }
  }

  async function deleteItem() {
    if (!showDelete || !server.node_id) return
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/node-files`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          serverId: server.id,
          path: showDelete.path,
          action: 'delete',
        }),
      })
      if (response.ok) {
        toast('success', 'Deleted')
        setShowDelete(null)
        loadFiles()
      }
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !server.node_id) return
    const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
    const reader = new FileReader()
    reader.onload = async () => {
      const content = reader.result as string
      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/node-files`
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            serverId: server.id,
            path: fullPath,
            action: 'write',
            content: btoa(content),
            binary: true,
          }),
        })
        if (response.ok) {
          toast('success', 'File uploaded')
          loadFiles()
        }
      } catch {
        toast('error', 'Upload failed')
      }
    }
    reader.readAsBinaryString(file)
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean)
  const filteredFiles = search
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files

  if (!server.node_id) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-warning mb-3" />
        <p className="text-sm font-medium">No compute node connected</p>
        <p className="text-xs text-muted-foreground mt-1">Connect a node agent to manage files</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setShowNewFolder(true); setNewName('') }}>
          <FolderPlus className="h-4 w-4" />New Folder
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setShowNewFile(true); setNewName('') }}>
          <FilePlus className="h-4 w-4" />New File
        </Button>
        <Button variant="outline" size="sm" asChild>
          <label className="cursor-pointer flex items-center gap-2">
            <Upload className="h-4 w-4" />Upload
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
        </Button>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto scrollbar-thin">
        <button onClick={() => navigateTo('/')} className="hover:text-foreground flex items-center gap-1">
          <Home className="h-3 w-3" />root
        </button>
        {breadcrumbs.map((crumb, i) => {
          const path = '/' + breadcrumbs.slice(0, i + 1).join('/')
          return (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button onClick={() => navigateTo(path)} className="hover:text-foreground">{crumb}</button>
            </span>
          )
        })}
      </div>

      {/* File list */}
      <div className="rounded-lg border border-border divide-y divide-border">
        {currentPath !== '/' && (
          <button
            onClick={navigateUp}
            className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 text-sm transition-colors"
          >
            <ChevronDown className="h-4 w-4 rotate-90 text-muted-foreground" />
            <span className="text-muted-foreground">..</span>
          </button>
        )}
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No files found</div>
        ) : (
          filteredFiles
            .sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1))
            .map((file) => (
              <div
                key={file.path}
                className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 text-sm transition-colors group"
              >
                <button onClick={() => handleClick(file)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                  {file.isDirectory ? (
                    <Folder className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <File className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                </button>
                <span className="text-xs text-muted-foreground shrink-0">{file.isDirectory ? '—' : formatBytes(file.size)}</span>
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{formatRelative(file.modified)}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {!file.isDirectory && (
                    <Button variant="ghost" size="icon-sm" onClick={() => openEditor(file)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={() => setShowDelete(file)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Editor dialog */}
      {editing && (
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm font-mono">{editPath}</DialogTitle>
            </DialogHeader>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 resize-none font-mono text-sm"
              spellCheck={false}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />Cancel
              </Button>
              <Button onClick={saveFile}>
                <Save className="h-4 w-4" />Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* New file dialog */}
      <Dialog open={showNewFile} onOpenChange={setShowNewFile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new file</DialogTitle>
          </DialogHeader>
          <Input placeholder="filename.txt" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFile(false)}>Cancel</Button>
            <Button onClick={() => createItem('file')}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new folder</DialogTitle>
          </DialogHeader>
          <Input placeholder="folder-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>Cancel</Button>
            <Button onClick={() => createItem('folder')}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!showDelete} onOpenChange={(v) => !v && setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {showDelete?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {showDelete?.isDirectory ? 'This will delete the folder and all its contents.' : 'This action cannot be undone.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteItem}>
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
