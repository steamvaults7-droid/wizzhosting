import { useState, useEffect, useCallback } from 'react'
import {
  Users, Shield, Ban, UserMinus, UserPlus, Check, X, Loader2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatRelative } from '@/lib/utils'
import type { ServerRecord, PlayerRecord } from '@/types'

export default function PlayersTab({ server }: { server: ServerRecord }) {
  const toast = useToast()
  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadPlayers = useCallback(async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('server_id', server.id)
      .order('online', { ascending: false })
    if (error) {
      toast('error', 'Failed to load players')
      return
    }
    setPlayers((data as PlayerRecord[]) || [])
    setLoading(false)
  }, [server.id, toast])

  useEffect(() => {
    loadPlayers()
    const interval = setInterval(loadPlayers, 10000)
    return () => clearInterval(interval)
  }, [loadPlayers])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`players-${server.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `server_id=eq.${server.id}` }, () => {
        loadPlayers()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [server.id, loadPlayers])

  async function logCommand(command: string) {
    await supabase.from('server_logs').insert({
      server_id: server.id,
      level: 'command',
      message: `> ${command}`,
    })
    await supabase.from('activity').insert({
      server_id: server.id,
      action: 'player_command',
      details: command,
    })
  }

  async function handleAction(player: PlayerRecord, action: 'op' | 'deop' | 'kick' | 'ban' | 'unban' | 'whitelist' | 'unwhitelist') {
    if (server.status !== 'online') {
      toast('warning', 'Server not running')
      return
    }
    const commands: Record<string, string> = {
      op: `op ${player.username}`,
      deop: `deop ${player.username}`,
      kick: `kick ${player.username}`,
      ban: `ban ${player.username}`,
      unban: `pardon ${player.username}`,
      whitelist: `whitelist add ${player.username}`,
      unwhitelist: `whitelist remove ${player.username}`,
    }
    const fieldMap: Record<string, Partial<PlayerRecord>> = {
      op: { is_op: true },
      deop: { is_op: false },
      ban: { is_banned: true, online: false },
      unban: { is_banned: false },
      whitelist: { is_whitelisted: true },
      unwhitelist: { is_whitelisted: false },
    }
    await logCommand(commands[action])
    await supabase.from('players').update(fieldMap[action]).eq('id', player.id)
    toast('success', `${action.charAt(0).toUpperCase() + action.slice(1)} executed`, commands[action])
    loadPlayers()
  }

  const filtered = search
    ? players.filter((p) => p.username.toLowerCase().includes(search.toLowerCase()))
    : players

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Players</h3>
          <p className="text-sm text-muted-foreground">{server.players_online} online of {players.length} known</p>
        </div>
        <div className="w-48">
          <Input placeholder="Search players..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No players yet. Players appear here once they join the server.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((player) => (
            <Card key={player.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${player.online ? 'bg-success' : 'bg-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{player.username}</p>
                        {player.is_op && <Badge variant="warning" className="text-xs">OP</Badge>}
                        {player.is_banned && <Badge variant="destructive" className="text-xs">Banned</Badge>}
                        {player.is_whitelisted && <Badge variant="success" className="text-xs">Whitelisted</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        UUID: {player.uuid.slice(0, 8)}... • Joined {formatRelative(player.first_joined)} • Seen {formatRelative(player.last_seen)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {!player.is_op ? (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(player, 'op')}>
                        <Shield className="h-3 w-3" />OP
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(player, 'deop')}>
                        <UserMinus className="h-3 w-3" />De-OP
                      </Button>
                    )}
                    {player.online && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(player, 'kick')}>
                        <UserMinus className="h-3 w-3" />Kick
                      </Button>
                    )}
                    {!player.is_banned ? (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleAction(player, 'ban')}>
                        <Ban className="h-3 w-3" />Ban
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-success" onClick={() => handleAction(player, 'unban')}>
                        <Check className="h-3 w-3" />Unban
                      </Button>
                    )}
                    {!player.is_whitelisted ? (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(player, 'whitelist')}>
                        <UserPlus className="h-3 w-3" />Whitelist
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(player, 'unwhitelist')}>
                        <X className="h-3 w-3" />Remove
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
