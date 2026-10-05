export type ServerStatus = 'offline' | 'starting' | 'online' | 'stopping' | 'sleeping' | 'error' | 'creating'

export type MinecraftEdition = 'java' | 'bedrock'

export type ServerSoftware =
  | 'vanilla'
  | 'paper'
  | 'purpur'
  | 'spigot'
  | 'fabric'
  | 'forge'
  | 'neoforge'
  | 'bedrock'

export type UserRole = 'user' | 'moderator' | 'admin' | 'owner'

export interface DatabaseUser {
  id: string
  username: string
  email: string
  avatar: string | null
  email_verified: boolean
  role: UserRole
  suspended: boolean
  created_at: string
  updated_at: string
  last_login: string | null
}

export interface ServerRecord {
  id: string
  owner_id: string
  name: string
  status: ServerStatus
  edition: MinecraftEdition
  version: string
  software: ServerSoftware
  node_id: string | null
  port: number | null
  address: string | null
  custom_address: string | null
  max_players: number
  motd: string
  ram_limit_mb: number
  cpu_limit_percent: number
  storage_limit_mb: number
  eula_accepted: boolean
  auto_start: boolean
  sleep_enabled: boolean
  sleep_timeout_minutes: number
  created_at: string
  updated_at: string
  last_started_at: string | null
  players_online: number
  cpu_usage: number
  ram_usage_mb: number
  storage_usage_mb: number
  network_in_kbps: number
  network_out_kbps: number
  uptime_seconds: number
}

export interface ComputeNode {
  id: string
  name: string
  status: 'online' | 'offline' | 'connecting'
  public_address: string | null
  available_ram_mb: number
  available_cpu_percent: number
  available_storage_mb: number
  used_ram_mb: number
  used_cpu_percent: number
  used_storage_mb: number
  total_servers: number
  last_seen_at: string | null
  java_version: string | null
  docker_available: boolean
  supported_editions: MinecraftEdition[]
}

export interface ServerLog {
  id: string
  server_id: string
  level: 'info' | 'warning' | 'error' | 'command'
  message: string
  created_at: string
}

export interface PlayerRecord {
  id: string
  server_id: string
  username: string
  uuid: string
  online: boolean
  first_joined: string
  last_seen: string
  is_op: boolean
  is_banned: boolean
  is_whitelisted: boolean
}

export interface BackupRecord {
  id: string
  server_id: string
  name: string
  size_bytes: number
  created_at: string
  status: 'creating' | 'complete' | 'failed' | 'restoring'
}

export interface ScheduleRecord {
  id: string
  server_id: string
  name: string
  action: 'start' | 'stop' | 'restart' | 'backup' | 'command'
  cron: string
  command: string | null
  enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
}

export interface ActivityRecord {
  id: string
  server_id: string | null
  user_id: string | null
  action: string
  details: string | null
  created_at: string
}

export interface FileEntry {
  name: string
  path: string
  is_directory: boolean
  size: number
  modified: string
  permissions: string | null
}

export interface ServerVersion {
  version: string
  edition: MinecraftEdition
  software: ServerSoftware[]
  release_date: string
  latest: boolean
}

export const SERVER_SOFTWARE_OPTIONS: { value: ServerSoftware; label: string; description: string; editions: MinecraftEdition[] }[] = [
  { value: 'vanilla', label: 'Vanilla', description: 'Official unmodified Minecraft server', editions: ['java'] },
  { value: 'paper', label: 'Paper', description: 'High-performance Spigot fork with plugin support', editions: ['java'] },
  { value: 'purpur', label: 'Purpur', description: 'Paper fork with extra features and performance', editions: ['java'] },
  { value: 'spigot', label: 'Spigot', description: 'Plugin-compatible server with optimizations', editions: ['java'] },
  { value: 'fabric', label: 'Fabric', description: 'Lightweight modding platform', editions: ['java'] },
  { value: 'forge', label: 'Forge', description: 'Classic modding platform with large mod ecosystem', editions: ['java'] },
  { value: 'neoforge', label: 'NeoForge', description: 'Modern Forge fork with improved APIs', editions: ['java'] },
  { value: 'bedrock', label: 'Bedrock', description: 'Official Bedrock Edition server', editions: ['bedrock'] },
]

// All Java Edition versions from latest to 1.0
export const JAVA_VERSIONS: string[] = [
  '26.1', '1.21.4', '1.21.3', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1',
  '1.19.4', '1.19.2', '1.19',
  '1.18.2', '1.18.1', '1.18',
  '1.17.1', '1.17',
  '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
  '1.15.2', '1.15.1',
  '1.14.4', '1.14.3', '1.14.2', '1.14.1',
  '1.13.2', '1.13.1',
  '1.12.2', '1.12.1',
  '1.11.2', '1.11.1',
  '1.10.2', '1.10.1',
  '1.9.4', '1.9.2',
  '1.8.9', '1.8.8', '1.8.7', '1.8.6', '1.8.5', '1.8.4', '1.8.3', '1.8.1', '1.8',
  '1.7.10', '1.7.9', '1.7.5', '1.7.4', '1.7.2',
  '1.6.4', '1.6.2',
  '1.5.2', '1.5.1',
  '1.4.7', '1.4.6', '1.4.5', '1.4.4', '1.4.2',
  '1.3.2', '1.3.1',
  '1.2.5', '1.2.4', '1.2.3', '1.2.2', '1.2.1',
  '1.1',
  '1.0',
]

// Software availability per Java version
// Paper/Purpur only support specific versions; Fabric supports most; Spigot supports most
export const SOFTWARE_VERSION_COMPAT: Partial<Record<ServerSoftware, string[]>> = {
  vanilla: JAVA_VERSIONS, // all versions
  fabric: [
    '1.21.4', '1.21.3', '1.21.1', '1.21',
    '1.20.6', '1.20.4', '1.20.2', '1.20.1',
    '1.19.4', '1.19.2',
    '1.18.2', '1.18.1', '1.18',
    '1.17.1',
    '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
    '1.15.2', '1.14.4', '1.14.3', '1.14.2',
    '1.13.2', '1.12.2', '1.11.2', '1.10.2', '1.9.4', '1.8.9', '1.7.10',
  ],
  paper: [
    '1.21.4', '1.21.3', '1.21.1', '1.21',
    '1.20.6', '1.20.4', '1.20.2', '1.20.1',
    '1.19.4', '1.19.2',
    '1.18.2', '1.18.1', '1.18',
    '1.17.1',
    '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
    '1.15.2', '1.14.4', '1.14.3', '1.14.2', '1.14.1',
    '1.13.2', '1.13.1', '1.13',
    '1.12.2', '1.12.1',
    '1.11.2',
    '1.10.2', '1.9.4', '1.8.9', '1.8.8', '1.8.7', '1.8.6', '1.8.5', '1.8.4', '1.8.3',
    '1.7.10',
  ],
  purpur: [
    '1.21.4', '1.21.3', '1.21.1', '1.21',
    '1.20.6', '1.20.4', '1.20.2', '1.20.1',
    '1.19.4', '1.19.2',
    '1.18.2', '1.18.1', '1.18',
    '1.17.1',
    '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
    '1.15.2', '1.14.4', '1.14.3', '1.14.2', '1.14.1',
    '1.13.2', '1.13.1',
    '1.12.2',
    '1.11.2',
    '1.10.2',
    '1.9.4',
    '1.8.9', '1.8.8',
  ],
  spigot: [
    '1.21.4', '1.21.3', '1.21.1', '1.21',
    '1.20.6', '1.20.4', '1.20.2', '1.20.1',
    '1.19.4', '1.19.2',
    '1.18.2', '1.18.1', '1.18',
    '1.17.1',
    '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
    '1.15.2', '1.14.4', '1.14.3', '1.14.2', '1.14.1',
    '1.13.2', '1.13.1',
    '1.12.2', '1.12.1',
    '1.11.2',
    '1.10.2',
    '1.9.4',
    '1.8.9', '1.8.8', '1.8.7', '1.8.6', '1.8.5', '1.8.4', '1.8.3', '1.8.1', '1.8',
    '1.7.10', '1.7.9', '1.7.5', '1.7.4', '1.7.2',
    '1.6.4', '1.6.2',
    '1.5.2', '1.5.1',
    '1.4.7', '1.4.6', '1.4.5', '1.4.4', '1.4.2',
    '1.3.2', '1.3.1',
    '1.2.5', '1.2.4', '1.2.3', '1.2.2', '1.2.1',
    '1.1',
    '1.0',
  ],
}

export function isSoftwareAvailableForVersion(software: ServerSoftware, version: string): boolean {
  if (software === 'bedrock') return true
  const compat = SOFTWARE_VERSION_COMPAT[software]
  if (!compat) return false
  return compat.includes(version)
}

export function getAvailableSoftwareForVersion(version: string, edition: MinecraftEdition): ServerSoftware[] {
  if (edition === 'bedrock') return ['bedrock']
  return SERVER_SOFTWARE_OPTIONS
    .filter((s) => s.editions.includes('java') && isSoftwareAvailableForVersion(s.value, version))
    .map((s) => s.value)
}

export const BEDROCK_VERSIONS: string[] = ['1.21.50', '1.21.40', '1.21.30', '1.21.20', '1.21.0', '1.20.80', '1.20.70']

export const FREE_TIER_LIMITS = {
  maxServers: 2,
  maxRamMb: 2048,
  maxCpuPercent: 100,
  maxStorageMb: 5120,
  maxPlayersPerServer: 20,
}

// Java version required per Minecraft version
export function getRequiredJavaVersion(mcVersion: string): string {
  const [release, minor, patch] = mcVersion.split('.').map(Number)
  if (release >= 26) return 'Java 25'
  if (minor >= 21 || (minor === 20 && patch >= 5)) return 'Java 21'
  if (minor >= 18) return 'Java 17'
  if (minor === 17) return 'Java 16'
  return 'Java 8'
}
