import { useState, useEffect } from 'react'
import { Save, Loader2, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@/components/ui/select'
import type { ServerRecord } from '@/types'

interface ServerSettings {
  motd: string
  difficulty: string
  gamemode: string
  hardcore: boolean
  pvp: boolean
  online_mode: boolean
  view_distance: number
  simulation_distance: number
  max_players: number
  spawn_protection: number
  command_blocks: boolean
  allow_flight: boolean
  whitelist: boolean
  force_gamemode: boolean
  resource_pack: string
  server_port: number
  level_seed: string
  level_type: string
  level_name: string
  generate_structures: boolean
  spawn_animals: boolean
  spawn_npcs: boolean
  spawn_monsters: boolean
  enforce_whitelist: boolean
}

const DEFAULT_SETTINGS: ServerSettings = {
  motd: 'A CubeForge Server',
  difficulty: 'normal',
  gamemode: 'survival',
  hardcore: false,
  pvp: true,
  online_mode: true,
  view_distance: 10,
  simulation_distance: 10,
  max_players: 20,
  spawn_protection: 16,
  command_blocks: false,
  allow_flight: false,
  whitelist: false,
  force_gamemode: false,
  resource_pack: '',
  server_port: 25565,
  level_seed: '',
  level_type: 'minecraft\\:normal',
  level_name: 'world',
  generate_structures: true,
  spawn_animals: true,
  spawn_npcs: true,
  spawn_monsters: true,
  enforce_whitelist: false,
}

export default function SettingsTab({ server }: { server: ServerRecord }) {
  const toast = useToast()
  const [settings, setSettings] = useState<ServerSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customAddress, setCustomAddress] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('server_settings')
        .select('*')
        .eq('server_id', server.id)
        .maybeSingle()
      if (data) {
        setSettings({ ...DEFAULT_SETTINGS, ...data } as ServerSettings)
      }
      setCustomAddress(server.custom_address || '')
      setLoading(false)
    }
    load()
  }, [server.id])

  function update<K extends keyof ServerSettings>(key: K, value: ServerSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('server_settings')
      .upsert({ ...settings, server_id: server.id })
    setSaving(false)
    if (error) {
      toast('error', 'Failed to save', error.message)
    } else {
      toast('success', 'Settings saved', 'Changes will apply after server restart')
      await supabase.from('activity').insert({
        server_id: server.id,
        action: 'update_settings',
        details: 'Server configuration updated',
      })
    }
  }

  async function handleReset() {
    setSettings(DEFAULT_SETTINGS)
    toast('info', 'Settings reset to defaults', 'Save to apply')
  }

  async function handleSaveAddress() {
    setSavingAddress(true)
    const trimmed = customAddress.trim()
    const { error } = await supabase
      .from('servers')
      .update({ custom_address: trimmed || null })
      .eq('id', server.id)
    setSavingAddress(false)
    if (error) {
      toast('error', 'Failed to save address', error.message)
    } else {
      toast('success', 'Custom address saved', trimmed ? `Players will see: ${trimmed}` : 'Using auto-detected IP address')
      await supabase.from('activity').insert({
        server_id: server.id,
        action: 'update_address',
        details: trimmed ? `Custom address set to ${trimmed}` : 'Custom address cleared',
      })
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Server Settings</h3>
          <p className="text-sm text-muted-foreground">Changes apply after the next restart</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
          </Button>
        </div>
      </div>

      {/* Basic */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic</CardTitle>
          <CardDescription>Core server configuration</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="motd">MOTD (Message of the Day)</Label>
            <Textarea id="motd" value={settings.motd} onChange={(e) => update('motd', e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select value={settings.difficulty} onValueChange={(v) => update('difficulty', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="peaceful">Peaceful</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gamemode</Label>
            <Select value={settings.gamemode} onValueChange={(v) => update('gamemode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="survival">Survival</SelectItem>
                <SelectItem value="creative">Creative</SelectItem>
                <SelectItem value="adventure">Adventure</SelectItem>
                <SelectItem value="spectator">Spectator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Max Players</Label>
            <Input type="number" min={1} max={999} value={settings.max_players} onChange={(e) => update('max_players', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Spawn Protection</Label>
            <Input type="number" min={0} max={100} value={settings.spawn_protection} onChange={(e) => update('spawn_protection', Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      {/* Gameplay */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gameplay</CardTitle>
          <CardDescription>Toggles for game mechanics</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'pvp', label: 'PvP', desc: 'Allow players to damage each other' },
            { key: 'hardcore', label: 'Hardcore', desc: 'Players get banned on death' },
            { key: 'online_mode', label: 'Online Mode', desc: 'Verify player accounts with Mojang' },
            { key: 'force_gamemode', label: 'Force Gamemode', desc: 'Players always join in server gamemode' },
            { key: 'command_blocks', label: 'Command Blocks', desc: 'Enable command blocks' },
            { key: 'allow_flight', label: 'Allow Flight', desc: 'Allow players to fly' },
            { key: 'whitelist', label: 'Whitelist', desc: 'Only whitelisted players can join' },
            { key: 'enforce_whitelist', label: 'Enforce Whitelist', desc: 'Kick non-whitelisted players immediately' },
            { key: 'generate_structures', label: 'Generate Structures', desc: 'Villages, dungeons, etc.' },
            { key: 'spawn_animals', label: 'Spawn Animals', desc: 'Allow animal spawning' },
            { key: 'spawn_npcs', label: 'Spawn NPCs', desc: 'Allow villager spawning' },
            { key: 'spawn_monsters', label: 'Spawn Monsters', desc: 'Allow hostile mob spawning' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 rounded-md bg-muted/20">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={settings[item.key as keyof ServerSettings] as boolean}
                onCheckedChange={(v) => update(item.key as keyof ServerSettings, v as any)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* World */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">World</CardTitle>
          <CardDescription>World generation settings</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Level Name</Label>
            <Input value={settings.level_name} onChange={(e) => update('level_name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Level Seed (blank for random)</Label>
            <Input value={settings.level_seed} onChange={(e) => update('level_seed', e.target.value)} placeholder="Random" />
          </div>
          <div className="space-y-2">
            <Label>Level Type</Label>
            <Select value={settings.level_type} onValueChange={(v) => update('level_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minecraft\\:normal">Normal</SelectItem>
                <SelectItem value="minecraft\\:flat">Flat</SelectItem>
                <SelectItem value="minecraft\\:large_biomes">Large Biomes</SelectItem>
                <SelectItem value="minecraft\\:amplified">Amplified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>View Distance (chunks)</Label>
            <Input type="number" min={3} max={32} value={settings.view_distance} onChange={(e) => update('view_distance', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Simulation Distance (chunks)</Label>
            <Input type="number" min={3} max={32} value={settings.simulation_distance} onChange={(e) => update('simulation_distance', Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      {/* Custom Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Server Address</CardTitle>
          <CardDescription>
            Set a custom address (like a domain name) that players see instead of your raw IP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Custom Address</Label>
            <div className="flex gap-2">
              <Input
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="e.g. play.myserver.com:25565 or myserver.ddns.net"
              />
              <Button size="sm" onClick={handleSaveAddress} disabled={savingAddress} className="shrink-0">
                {savingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank to use your auto-detected IP address. Include the port if it's not 25565.
              The actual server still runs on your computer — this only changes what address is displayed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resource pack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resource Pack</CardTitle>
          <CardDescription>Optional server resource pack</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Resource Pack URL</Label>
            <Input value={settings.resource_pack} onChange={(e) => update('resource_pack', e.target.value)} placeholder="https://example.com/pack.zip" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
