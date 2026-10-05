import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Loader2, Check, Server, Globe,
  Package, Cpu, MemoryStick, AlertCircle, Rocket, FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  SERVER_SOFTWARE_OPTIONS, JAVA_VERSIONS, BEDROCK_VERSIONS, FREE_TIER_LIMITS,
  isSoftwareAvailableForVersion, getRequiredJavaVersion,
} from '@/types'
import type { MinecraftEdition, ServerSoftware } from '@/types'

const STEPS = ['Name', 'Edition', 'Version', 'Software', 'Resources', 'Review']

export default function CreateServer() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [edition, setEdition] = useState<MinecraftEdition>('java')
  const [version, setVersion] = useState(JAVA_VERSIONS[0])
  const [software, setSoftware] = useState<ServerSoftware>('paper')
  const [ramMb, setRamMb] = useState(1024)
  const [cpuPercent, setCpuPercent] = useState(50)
  const [storageMb, setStorageMb] = useState(2048)
  const [maxPlayers, setMaxPlayers] = useState(20)
  const [eulaAccepted, setEulaAccepted] = useState(false)

  // Existing server count check
  const [serverCount, setServerCount] = useState(0)
  const [availableNodes, setAvailableNodes] = useState<{ id: string; name: string; available_ram_mb: number }[]>([])

  useEffect(() => {
    supabase.from('servers').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setServerCount(count ?? 0)
    })
    supabase.from('compute_nodes').select('id,name,available_ram_mb').eq('status', 'online').then(({ data }) => {
      setAvailableNodes(data || [])
    })
  }, [])

  const canCreate = serverCount < FREE_TIER_LIMITS.maxServers
  const nodeAvailable = availableNodes.length > 0

  function handleNext() {
    if (step === 0 && name.trim().length < 3) {
      toast('error', 'Name too short', 'Server name must be at least 3 characters')
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleEditionChange(ed: MinecraftEdition) {
    setEdition(ed)
    if (ed === 'java') {
      setVersion(JAVA_VERSIONS[0])
      setSoftware('vanilla')
    } else {
      setVersion(BEDROCK_VERSIONS[0])
      setSoftware('bedrock')
    }
  }

  function handleVersionChange(v: string) {
    setVersion(v)
    // If current software isn't available for this version, reset to vanilla
    if (edition === 'java' && !isSoftwareAvailableForVersion(software, v)) {
      setSoftware('vanilla')
    }
  }

  async function handleCreate() {
    if (!eulaAccepted) {
      toast('error', 'EULA required', 'You must accept the Minecraft EULA to create a server')
      return
    }
    if (!canCreate) {
      toast('error', 'Server limit reached', `You can create up to ${FREE_TIER_LIMITS.maxServers} servers`)
      return
    }

    setLoading(true)
    try {
      // First verify the user has a profile (required by FK constraint)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user?.id)
        .maybeSingle()

      if (profileError || !profile) {
        throw new Error('Your user profile is not set up yet. Please log out and log back in.')
      }

      const { data: node } = await supabase
        .from('compute_nodes')
        .select('id')
        .eq('status', 'online')
        .order('total_servers', { ascending: true })
        .limit(1)
        .maybeSingle()

      const { data, error } = await supabase
        .from('servers')
        .insert({
          owner_id: user?.id,
          name: name.trim(),
          edition,
          version,
          software,
          status: 'creating',
          ram_limit_mb: ramMb,
          cpu_limit_percent: cpuPercent,
          storage_limit_mb: storageMb,
          max_players: maxPlayers,
          eula_accepted: true,
          node_id: node?.id ?? null,
        })
        .select()
        .single()

      if (error) throw error

      // Create default server settings
      await supabase.from('server_settings').insert({
        server_id: data.id,
        server_port: edition === 'java' ? 25565 : 19132,
        max_players: maxPlayers,
      })

      // Log activity
      await supabase.from('activity').insert({
        server_id: data.id,
        user_id: user?.id,
        action: 'create_server',
        details: `Created ${name} (${edition} ${software} ${version})`,
      })

      toast('success', 'Server created!', 'Redirecting to your server panel...')
      navigate(`/server/${data.id}`)
    } catch (err) {
      toast('error', 'Creation failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const compatibleSoftware = SERVER_SOFTWARE_OPTIONS.filter((s) =>
    s.editions.includes(edition) &&
    (edition === 'bedrock' || isSoftwareAvailableForVersion(s.value, version))
  )

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Server</h1>
          <p className="text-muted-foreground text-sm mt-1">Set up your Minecraft server in a few steps</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard"><ChevronLeft className="h-4 w-4" />Back</Link>
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border transition-all',
                i < step && 'bg-primary text-primary-foreground border-primary',
                i === step && 'bg-primary/10 text-primary border-primary',
                i > step && 'bg-muted text-muted-foreground border-border'
              )}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn(
                'text-xs hidden sm:block',
                i === step ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-px mx-2 transition-colors',
                i < step ? 'bg-primary' : 'bg-border'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Node warning */}
      {!nodeAvailable && (
        <Card className="border-warning/30 bg-warning/5 mb-6">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">No compute node connected</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can create the server now, but it won't start until you connect a node agent.
                See the setup guide after creating your account.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!canCreate && (
        <Card className="border-destructive/30 bg-destructive/5 mb-6">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Server limit reached</p>
              <p className="text-xs text-muted-foreground mt-1">
                You have {serverCount} servers (max {FREE_TIER_LIMITS.maxServers}). Delete one to create a new server.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {/* Step 0: Name */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Name your server</h2>
                <p className="text-sm text-muted-foreground mt-1">This is how your server appears in the dashboard</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-name">Server name</Label>
                <Input
                  id="server-name"
                  placeholder="My Awesome Server"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={32}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">{name.length}/32 characters</p>
              </div>
            </div>
          )}

          {/* Step 1: Edition */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Choose your edition</h2>
                <p className="text-sm text-muted-foreground mt-1">Java for PC players, Bedrock for cross-platform</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { value: 'java', label: 'Java Edition', desc: 'For PC players with the Java version of Minecraft', icon: Server },
                  { value: 'bedrock', label: 'Bedrock Edition', desc: 'For cross-platform play (PC, mobile, console)', icon: Globe },
                ] as const).map((ed) => (
                  <button
                    key={ed.value}
                    onClick={() => handleEditionChange(ed.value)}
                    className={cn(
                      'p-5 rounded-lg border-2 text-left transition-all',
                      edition === ed.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    )}
                  >
                    <ed.icon className={cn('h-8 w-8 mb-3', edition === ed.value ? 'text-primary' : 'text-muted-foreground')} />
                    <h3 className="font-semibold">{ed.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{ed.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Version */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Select Minecraft version</h2>
                <p className="text-sm text-muted-foreground mt-1">Pick the version you want to play on</p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto scrollbar-thin">
                {(edition === 'java' ? JAVA_VERSIONS : BEDROCK_VERSIONS).map((v) => (
                  <button
                    key={v}
                    onClick={() => handleVersionChange(v)}
                    className={cn(
                      'p-3 rounded-md border text-center text-sm font-medium transition-all',
                      version === v
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Software */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Choose server software</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {edition === 'java'
                    ? 'Available software depends on the version you selected. Vanilla works for all versions.'
                    : 'Official Bedrock server software.'}
                </p>
                {edition === 'java' && compatibleSoftware.length === 0 && (
                  <p className="text-xs text-warning mt-2">
                    No server software available for {version}. Try a different version.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                {compatibleSoftware.map((sw) => (
                  <button
                    key={sw.value}
                    onClick={() => setSoftware(sw.value)}
                    className={cn(
                      'w-full p-4 rounded-lg border-2 text-left transition-all flex items-center gap-4',
                      software === sw.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                      software === sw.value ? 'bg-primary/10' : 'bg-muted'
                    )}>
                      <Package className={cn('h-5 w-5', software === sw.value ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{sw.label}</h3>
                      <p className="text-xs text-muted-foreground">{sw.description}</p>
                    </div>
                    {software === sw.value && <Check className="h-5 w-5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Resources */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Allocate resources</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Free tier: up to {FREE_TIER_LIMITS.maxRamMb / 1024} GB RAM, {FREE_TIER_LIMITS.maxStorageMb / 1024} GB storage
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2"><MemoryStick className="h-4 w-4" /> RAM</Label>
                    <span className="text-sm font-medium">{ramMb} MB</span>
                  </div>
                  <input
                    type="range"
                    min={512}
                    max={FREE_TIER_LIMITS.maxRamMb}
                    step={256}
                    value={ramMb}
                    onChange={(e) => setRamMb(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>512 MB</span>
                    <span>{FREE_TIER_LIMITS.maxRamMb / 1024} GB</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2"><Cpu className="h-4 w-4" /> CPU</Label>
                    <span className="text-sm font-medium">{cpuPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={FREE_TIER_LIMITS.maxCpuPercent}
                    step={25}
                    value={cpuPercent}
                    onChange={(e) => setCpuPercent(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>25%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Storage limit</Label>
                    <span className="text-sm font-medium">{(storageMb / 1024).toFixed(1)} GB</span>
                  </div>
                  <input
                    type="range"
                    min={512}
                    max={FREE_TIER_LIMITS.maxStorageMb}
                    step={512}
                    value={storageMb}
                    onChange={(e) => setStorageMb(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0.5 GB</span>
                    <span>{FREE_TIER_LIMITS.maxStorageMb / 1024} GB</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Max players</Label>
                    <span className="text-sm font-medium">{maxPlayers}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={FREE_TIER_LIMITS.maxPlayersPerServer}
                    step={1}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1</span>
                    <span>{FREE_TIER_LIMITS.maxPlayersPerServer}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Review and create</h2>
                <p className="text-sm text-muted-foreground mt-1">Check your settings before creating</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Name', value: name },
                  { label: 'Edition', value: edition === 'java' ? 'Java Edition' : 'Bedrock Edition' },
                  { label: 'Version', value: version },
                  { label: 'Software', value: software.charAt(0).toUpperCase() + software.slice(1) },
                  { label: 'Java Required', value: edition === 'java' ? getRequiredJavaVersion(version) : 'N/A' },
                  { label: 'RAM', value: `${ramMb} MB` },
                  { label: 'CPU', value: `${cpuPercent}%` },
                  { label: 'Storage', value: `${(storageMb / 1024).toFixed(1)} GB` },
                  { label: 'Max Players', value: String(maxPlayers) },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-md bg-muted/30">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* EULA */}
              <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Minecraft EULA</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      By creating this server, you agree to the{' '}
                      <a href="https://aka.ms/MinecraftEULA" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Minecraft End User License Agreement
                      </a>.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={eulaAccepted} onCheckedChange={setEulaAccepted} />
                  <span className="text-sm">I accept the Minecraft EULA</span>
                </label>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
            <Button variant="ghost" onClick={handleBack} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4" />Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={handleNext}>
                Next<ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={loading || !eulaAccepted || !canCreate}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Create Server
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
