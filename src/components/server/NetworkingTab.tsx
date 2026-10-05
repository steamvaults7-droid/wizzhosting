import { useState } from 'react'
import { Copy, Globe, Info, Router, Wifi } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { copyToClipboard } from '@/lib/utils'
import type { ServerRecord } from '@/types'

export default function NetworkingTab({ server }: { server: ServerRecord }) {
  const toast = useToast()

  function copy(text: string, label: string) {
    copyToClipboard(text).then(() => toast('success', `${label} copied`))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Networking</h3>
        <p className="text-sm text-muted-foreground">Server connection details and port configuration</p>
      </div>

      {/* Connection info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Connection Address</CardTitle>
          <CardDescription>Share this with players to join your server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Server Address</p>
              <p className="font-mono text-lg">
                {server.address || 'Not assigned — no node connected'}
              </p>
            </div>
            {server.address && (
              <Button variant="outline" size="sm" onClick={() => copy(server.address!, 'Address')}>
                <Copy className="h-4 w-4" />Copy
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">IP / Host</p>
              <p className="font-mono text-sm mt-0.5">{server.address?.split(':')[0] ?? '—'}</p>
            </div>
            <div className="p-3 rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">Port</p>
              <p className="font-mono text-sm mt-0.5">{server.port ?? '—'}</p>
            </div>
            <div className="p-3 rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">Edition</p>
              <p className="text-sm font-medium mt-0.5 capitalize">{server.edition}</p>
            </div>
            <div className="p-3 rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">Protocol</p>
              <p className="text-sm font-medium mt-0.5">{server.edition === 'java' ? 'TCP' : 'UDP'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Port forwarding guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Router className="h-4 w-4 text-primary" />Port Forwarding</CardTitle>
          <CardDescription>Allow players outside your network to connect</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">How to let friends join from other networks</p>
              <p className="text-muted-foreground mt-1">
                If your node agent runs on your home computer, other players need port forwarding to reach you.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">1</div>
              <p className="text-sm">Log in to your router's admin panel (usually <code className="text-xs bg-muted/30 px-1 rounded">192.168.1.1</code> or <code className="text-xs bg-muted/30 px-1 rounded">10.0.0.1</code>)</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">2</div>
              <p className="text-sm">Find the Port Forwarding section (sometimes under NAT or Advanced)</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">3</div>
              <p className="text-sm">
                Add a rule: forward port <strong className="text-primary">{server.port ?? '25565'}</strong> {server.edition === 'bedrock' ? 'UDP' : 'TCP'} to your computer's local IP
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">4</div>
              <p className="text-sm">Players connect using your public IP + port (shown above)</p>
            </div>
          </div>

          <div className="p-3 rounded-md bg-warning/10 border border-warning/20">
            <p className="text-sm">
              <span className="font-medium text-warning">Alternative:</span> Use a free tunnel like <strong>Cloudflare Tunnel</strong> or <strong>ngrok</strong> — no router config needed. These give you a public address that routes to your local server.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Subdomain architecture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wifi className="h-4 w-4 text-primary" />Subdomain Support</CardTitle>
          <CardDescription>Custom domain architecture</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            If you own a domain, you can set up a wildcard DNS record pointing to your node's IP:
          </p>
          <div className="p-3 rounded-md bg-muted/30 border border-border">
            <code className="text-xs sm:text-sm break-all">
              *.cubeforge.yourdomain.com → {server.address?.split(':')[0] ?? 'YOUR_NODE_IP'}
            </code>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            This enables addresses like <code className="text-xs bg-muted/30 px-1 rounded">{server.name.toLowerCase().replace(/\s+/g, '-')}.yourdomain.com</code> for each server.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
