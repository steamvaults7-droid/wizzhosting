#!/usr/bin/env node

/**
 * CubeForge Node Agent v5.0
 *
 * Major fixes in v4:
 * - Prevents duplicate server starts (checks runningServers before launching)
 * - Detects Java version and picks the right one per MC version
 * - Restart = stop then start (not just "starting" status)
 * - Per-server command polling with timestamp cursor (no infinite loops)
 * - Detects deleted servers and cleans up
 * - Stale starting/stopping servers get reset on agent startup
 * - Custom address support from server record
 */

import { createServer as createHttpServer } from 'http'
import { createServer as createNetServer } from 'net'
import { spawn, execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, rmdirSync, createWriteStream } from 'fs'
import { join, dirname, normalize } from 'path'
import { homedir, platform, networkInterfaces, totalmem, freemem, cpus } from 'os'
import { createHash } from 'crypto'

function loadEnvironment() {
  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvironment()

// ===== Configuration =====
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  console.error('\n[ERROR] Missing SUPABASE_URL! Copy .env.example to .env and fill in the values.\n')
  process.exit(1)
}
if (!SUPABASE_KEY) {
  console.error('\n[ERROR] Missing SUPABASE_KEY!\n')
  process.exit(1)
}

const NODE_NAME = process.env.NODE_NAME || `${homedir().split('/').pop()}-${platform()}`
const NODE_PORT = parseInt(process.env.NODE_PORT || '31337')
const SERVERS_DIR = process.env.SERVERS_DIR || join(homedir(), '.cubeforge', 'servers')
const BASE_PORT = 25565
const HEARTBEAT_INTERVAL = 5000
const COMMAND_POLL_INTERVAL = 2000

// ===== State =====
let nodeId = null
let shuttingDown = false
const runningServers = new Map()       // serverId -> { process, port, startTime, address, pid, prevCpuTime, playersOnline, isRestarting }
const pendingCommands = new Map()      // serverId -> string[]
const processedCommandIds = new Set()
const startingServers = new Set()      // serverIds currently being started (prevents duplicate starts)
const serverCursors = new Map()        // serverId -> ISO timestamp (last command poll time)

// ===== Java Detection =====

function checkJava() {
  try {
    const output = execSync('java -version 2>&1', { encoding: 'utf-8' })
    const match = output.match(/version "(\d+[\d._]*)"/)
    return match ? match[1] : 'unknown'
  } catch {
    return null
  }
}

function getJavaMajorVersion(javaVer) {
  if (!javaVer) return 0
  // Handle "1.8.0_321" -> 8, "17.0.1" -> 17, "21.0.1" -> 21
  const parts = javaVer.split('.')
  if (parts[0] === '1') return parseInt(parts[1]) || 0
  return parseInt(parts[0]) || 0
}

function getRequiredJavaMajor(mcVersion) {
  const [release, minor, patch] = mcVersion.split('.').map(Number)
  if (release >= 26) return 25
  if (minor >= 21 || (minor === 20 && patch >= 5)) return 21
  if (minor >= 18) return 17
  if (minor === 17) return 16
  return 8
}

function findJavaForVersion(mcVersion) {
  const requiredMajor = getRequiredJavaMajor(mcVersion)
  const defaultJava = checkJava()
  const defaultMajor = getJavaMajorVersion(defaultJava)

  if (defaultMajor >= requiredMajor) {
    return { path: 'java', version: defaultJava }
  }

  // On Windows, try to find other Java installations
  if (process.platform === 'win32') {
    const searchPaths = [
      'C:\\Program Files\\Java',
      'C:\\Program Files (x86)\\Java',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Microsoft',
    ]
    for (const searchPath of searchPaths) {
      if (!existsSync(searchPath)) continue
      try {
        const entries = readdirSync(searchPath)
        for (const entry of entries) {
          if (entry.toLowerCase().includes('jdk') || entry.toLowerCase().includes('jre')) {
            const versionMatch = entry.match(/(\d+)/)
            if (versionMatch) {
              const foundMajor = parseInt(versionMatch[1])
              if (foundMajor >= requiredMajor) {
                const javaPath = join(searchPath, entry, 'bin', 'java.exe')
                if (existsSync(javaPath)) {
                  return { path: `"${javaPath}"`, version: entry }
                }
              }
            }
          }
        }
      } catch {}
    }
  }

  // Try common Linux/Mac paths
  const unixPaths = [
    `/usr/lib/jvm/java-${requiredMajor}-openjdk/bin/java`,
    `/usr/lib/jvm/java-${requiredMajor}-openjdk-amd64/bin/java`,
    `/usr/lib/jvm/temurin-${requiredMajor}-amd64/bin/java`,
    `/opt/homebrew/opt/openjdk@${requiredMajor}/bin/java`,
    `/usr/local/opt/openjdk@${requiredMajor}/bin/java`,
  ]
  for (const p of unixPaths) {
    if (existsSync(p)) return { path: p, version: `Java ${requiredMajor}` }
  }

  throw new Error(`Minecraft ${mcVersion} requires Java ${requiredMajor}+. Install that Java version and make sure it is available to the Node Agent.`)
}

// ===== Utility Functions =====

function getLocalIP() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return '127.0.0.1'
}

function getFreePort(startPort) {
  return new Promise((resolve) => {
    const tester = createNetServer()
    tester.listen(startPort, () => tester.close(() => resolve(startPort)))
    tester.on('error', () => resolve(getFreePort(startPort + 1)))
  })
}

function ensureServerDir(serverId) {
  const dir = join(SERVERS_DIR, serverId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getServerDir(serverId) {
  return join(SERVERS_DIR, serverId)
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// ===== Download with streaming progress =====

async function downloadWithProgress(url, destPath, serverId) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`)
  const contentLength = parseInt(resp.headers.get('content-length') || '0')
  const totalStr = contentLength > 0 ? formatBytes(contentLength) : 'unknown size'
  let received = 0
  let lastReportTime = 0
  const startTime = Date.now()
  const writer = createWriteStream(destPath)
  const reader = resp.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    writer.write(value)
    received += value.length
    const now = Date.now()
    if (now - lastReportTime > 500) {
      lastReportTime = now
      const receivedStr = formatBytes(received)
      const percent = contentLength > 0 ? ((received / contentLength) * 100).toFixed(1) : '?'
      const elapsed = ((now - startTime) / 1000).toFixed(0)
      const speed = contentLength > 0 && elapsed > 0
        ? formatBytes(Math.floor(received / parseInt(elapsed))) + '/s' : ''
      if (contentLength > 0) {
        process.stdout.write(`\r[Server ${serverId}] Downloading: ${receivedStr} / ${totalStr} (${percent}%) ${speed}    `)
      } else {
        process.stdout.write(`\r[Server ${serverId}] Downloading: ${receivedStr}    `)
      }
    }
  }
  await writer.end()
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  process.stdout.write(`\r[Server ${serverId}] Download complete: ${formatBytes(received)} in ${totalTime}s                    \n`)
}

// Wait for a file write to finish (Windows sometimes lags)
async function waitForFile(filePath, maxWait = 5000) {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    if (existsSync(filePath)) {
      const stat = statSync(filePath)
      if (stat.size > 0) return true
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return existsSync(filePath)
}

async function downloadServerJar(server) {
  const dir = getServerDir(server.id)
  const jarPath = join(dir, 'server.jar')

  if (existsSync(jarPath) && statSync(jarPath).size > 0) {
    console.log(`[Server ${server.id}] server.jar already exists, skipping download`)
    return jarPath
  }

  const version = server.version
  let downloadUrl = null

  if (server.software === 'vanilla') {
    console.log(`[Server ${server.id}] Fetching vanilla ${version} download URL...`)
    const manifestResp = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
    const manifest = await manifestResp.json()
    const versionData = manifest.versions.find(v => v.id === version)
    if (!versionData) throw new Error(`Version ${version} not found in Mojang manifest`)
    const versionResp = await fetch(versionData.url)
    const versionJson = await versionResp.json()
    if (!versionJson.downloads?.server?.url) throw new Error(`No server download for ${version}`)
    downloadUrl = versionJson.downloads.server.url
  } else if (server.software === 'paper' || server.software === 'purpur') {
    const apiBase = server.software === 'paper'
      ? 'https://api.papermc.io/v2/projects/paper'
      : 'https://api.purpurmc.org/v2/purpur'
    if (server.software === 'paper') {
      console.log(`[Server ${server.id}] Fetching Paper ${version}...`)
      const versionsResp = await fetch(`${apiBase}/versions/${version}`)
      if (!versionsResp.ok) throw new Error(`Paper ${version} not found`)
      const versionsData = await versionsResp.json()
      const build = versionsData.builds[versionsData.builds.length - 1]
      downloadUrl = `${apiBase}/versions/${version}/builds/${build}/downloads/paper-${version}-${build}.jar`
    } else {
      console.log(`[Server ${server.id}] Fetching Purpur ${version}...`)
      const versionsResp = await fetch(`${apiBase}/${version}/latest`)
      if (!versionsResp.ok) throw new Error(`Purpur ${version} not found`)
      const purpurData = await versionsResp.json()
      downloadUrl = `https://api.purpurmc.org/v2/purpur/${version}/${purpurData.build}/download`
    }
  } else if (server.software === 'fabric') {
    console.log(`[Server ${server.id}] Downloading Fabric installer...`)
    const installerUrl = 'https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar'
    const installerPath = join(dir, 'fabric-installer.jar')
    await downloadWithProgress(installerUrl, installerPath, server.id)
    const javaInfo = findJavaForVersion(version)
    console.log(`[Server ${server.id}] Running Fabric installer for ${version} with ${javaInfo.version}...`)
    execSync(`${javaInfo.path} -jar fabric-installer.jar server -mcversion ${version} -downloadMinecraft`, {
      cwd: dir, stdio: ['pipe', 'inherit', 'inherit'],
    })
    if (existsSync(installerPath)) unlinkSync(installerPath)
    const fabricJar = join(dir, 'fabric-server-launch.jar')
    if (!existsSync(fabricJar)) throw new Error('Fabric installation did not produce fabric-server-launch.jar')
    return fabricJar
  } else if (server.software === 'spigot') {
    // Spigot requires BuildTools - download from GetBukkit mirror
    console.log(`[Server ${server.id}] Downloading Spigot ${version}...`)
    downloadUrl = `https://download.getbukkit.org/spigot/spigot-${version}.jar`
  } else if (server.software === 'forge' || server.software === 'neoforge') {
    throw new Error(`${server.software} requires manual setup. Place the server jar in: ${dir}`)
  } else if (server.software === 'bedrock') {
    throw new Error('Bedrock requires manual setup. Download from minecraft.net and place in: ' + dir)
  }

  if (!downloadUrl) throw new Error(`Could not find download URL for ${server.software} ${version}`)
  console.log(`[Server ${server.id}] Downloading from ${downloadUrl}...`)
  await downloadWithProgress(downloadUrl, jarPath, server.id)
  await waitForFile(jarPath)
  return jarPath
}

// ===== server.properties =====

function generateServerProperties(settings) {
  const props = {
    'motd': settings.motd || 'A CubeForge Server',
    'difficulty': settings.difficulty || 'normal',
    'gamemode': settings.gamemode || 'survival',
    'hardcore': settings.hardcore ? 'true' : 'false',
    'pvp': settings.pvp ? 'true' : 'false',
    'online-mode': settings.online_mode ? 'true' : 'false',
    'view-distance': String(settings.view_distance || 10),
    'simulation-distance': String(settings.simulation_distance || 10),
    'max-players': String(settings.max_players || 20),
    'spawn-protection': String(settings.spawn_protection || 16),
    'enable-command-block': settings.command_blocks ? 'true' : 'false',
    'allow-flight': settings.allow_flight ? 'true' : 'false',
    'white-list': settings.whitelist ? 'true' : 'false',
    'force-gamemode': settings.force_gamemode ? 'true' : 'false',
    'generate-structures': settings.generate_structures ? 'true' : 'false',
    'spawn-animals': settings.spawn_animals ? 'true' : 'false',
    'spawn-npcs': settings.spawn_npcs ? 'true' : 'false',
    'spawn-monsters': settings.spawn_monsters ? 'true' : 'false',
    'enforce-whitelist': settings.enforce_whitelist ? 'true' : 'false',
    'level-name': settings.level_name || 'world',
    'level-type': settings.level_type || 'minecraft\\:normal',
    'max-world-size': String(settings.max_world_size || 29999984),
  }
  if (settings.level_seed) props['level-seed'] = settings.level_seed
  if (settings.resource_pack) props['resource-pack'] = settings.resource_pack
  return Object.entries(props).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
}

// ===== Process Metrics (cross-platform) =====

async function getRealMetrics(entry) {
  if (!entry || !entry.process || entry.process.exitCode !== null) return { cpu: 0, ram: 0, storageMb: 0, netInKbps: 0, netOutKbps: 0 }
  try {
    const pid = entry.process.pid

    // Get storage usage for server directory
    let storageMb = 0
    try {
      const dir = getServerDir(entry.serverId)
      if (existsSync(dir)) {
        storageMb = Math.floor(await getDirSize(dir) / (1024 * 1024))
      }
    } catch {}

    // Get network metrics (delta of total bytes sent/received by process)
    let netInKbps = 0, netOutKbps = 0
    try {
      if (existsSync(`/proc/${pid}/net/dev`)) {
        // Linux: read network stats (simplified — uses system-wide delta)
        // Not per-process, but gives an approximation
      }
      // Use entry-level network tracking if available
      if (entry.prevNetIn !== undefined) {
        // We don't have direct per-process network counters without extra deps
        // Estimate from uptime and a small baseline — 0 if no data
      }
    } catch {}

    if (existsSync(`/proc/${pid}/status`)) {
      const status = readFileSync(`/proc/${pid}/status`, 'utf-8')
      const vmRSSMatch = status.match(/VmRSS:\s*(\d+)\s*kB/)
      const ramMb = vmRSSMatch ? Math.floor(parseInt(vmRSSMatch[1]) / 1024) : 0
      if (existsSync(`/proc/${pid}/stat`)) {
        const stat = readFileSync(`/proc/${pid}/stat`, 'utf-8').trim().split(' ')
        const utime = parseInt(stat[13]) || 0
        const stime = parseInt(stat[14]) || 0
        const totalTime = utime + stime
        const prevTime = entry.prevCpuTime || totalTime
        const cpuDelta = totalTime - prevTime
        entry.prevCpuTime = totalTime
        const cpuPercent = Math.min(100, Math.round((cpuDelta / 100) / (HEARTBEAT_INTERVAL / 1000) * 100))
        return { cpu: cpuPercent, ram: ramMb, storageMb, netInKbps, netOutKbps }
      }
      return { cpu: 0, ram: ramMb, storageMb, netInKbps, netOutKbps }
    }
    if (process.platform === 'win32') {
      try {
        // Use PowerShell instead of deprecated wmic
        const psCmd = `Get-Process -Id ${pid} | Select-Object WorkingSet64,TotalProcessorTime,CPU | ConvertTo-Csv -NoTypeInformation`
        const out = execSync(`powershell -NoProfile -Command "${psCmd}"`, {
          encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
        })
        const lines = out.trim().split('\n').filter(l => l.trim() && !l.startsWith('"#'))
        if (lines.length >= 2) {
          const dataLine = lines[1].replace(/"/g, '')
          const parts = dataLine.split(',')
          const ramMb = parts[0] ? Math.floor(parseInt(parts[0]) / (1024 * 1024)) : 0
          // TotalProcessorTime is a timespan like "00:00:01.234"
          const timeStr = parts[1] || '0'
          const timeParts = timeStr.split(':')
          const totalTime = (parseInt(timeParts[0]) || 0) * 3600 + (parseInt(timeParts[1]) || 0) * 60 + (parseFloat(timeParts[2]) || 0)
          const prevTime = entry.prevCpuTime || totalTime
          const cpuDelta = totalTime - prevTime
          entry.prevCpuTime = totalTime
          const cpuPercent = Math.min(100, Math.round((cpuDelta / (HEARTBEAT_INTERVAL / 1000)) * 100))
          return { cpu: cpuPercent, ram: ramMb, storageMb, netInKbps, netOutKbps }
        }
        return { cpu: 0, ram: 0, storageMb, netInKbps, netOutKbps }
      } catch {
        // Fallback: try wmic as last resort
        try {
          const out = execSync(`wmic process where ProcessId=${pid} get WorkingSetSize,KernelModeTime,UserModeTime /format:value`, {
            encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
          })
          const wsMatch = out.match(/WorkingSetSize=(\d+)/)
          const kmtMatch = out.match(/KernelModeTime=(\d+)/)
          const umtMatch = out.match(/UserModeTime=(\d+)/)
          const ramMb = wsMatch ? Math.floor(parseInt(wsMatch[1]) / (1024 * 1024)) : 0
          const totalTime = (parseInt(kmtMatch?.[1] || 0) + parseInt(umtMatch?.[1] || 0)) / 10000000
          const prevTime = entry.prevCpuTime || totalTime
          const cpuDelta = totalTime - prevTime
          entry.prevCpuTime = totalTime
          const cpuPercent = Math.min(100, Math.round((cpuDelta / (HEARTBEAT_INTERVAL / 1000)) * 100))
          return { cpu: cpuPercent, ram: ramMb, storageMb, netInKbps, netOutKbps }
        } catch { return { cpu: 0, ram: 0, storageMb, netInKbps, netOutKbps } }
      }
    }
    try {
      const psOut = execSync(`ps -o rss=,pcpu= -p ${pid} 2>/dev/null`, {
        encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
      }).trim().split(/\s+/)
      const ramMb = Math.floor(parseInt(psOut[0]) / 1024) || 0
      const cpuPercent = Math.round(parseFloat(psOut[1]) || 0)
      return { cpu: cpuPercent, ram: ramMb, storageMb, netInKbps, netOutKbps }
    } catch { return { cpu: 0, ram: 0, storageMb, netInKbps, netOutKbps } }
  } catch { return { cpu: 0, ram: 0, storageMb: 0, netInKbps: 0, netOutKbps: 0 } }
}

// ===== Player tracking =====

function parsePlayerEvent(line) {
  const joinMatch = line.match(/(\w+)\[\/([\d.]+):\d+\] logged in with entity id/)
  if (joinMatch) return { type: 'join', username: joinMatch[1], ip: joinMatch[2] }
  const leaveMatch = line.match(/(\w+) left the game/)
  if (leaveMatch) return { type: 'leave', username: leaveMatch[1] }
  return null
}

function generateOfflineUuid(username) {
  const hash = createHash('md5').update('OfflinePlayer:' + username).digest()
  hash[6] = (hash[6] & 0x0f) | 0x30
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.toString('hex')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}

async function reportPlayerEvent(serverId, event) {
  try {
    const uuid = generateOfflineUuid(event.username)
    await fetch(`${API_URL}/player-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ serverId, username: event.username, uuid, online: event.type === 'join' }),
    })
  } catch {}
}

// ===== API Helpers =====

const API_URL = `${SUPABASE_URL}/functions/v1/node-api`

async function reportStatus(serverId, status, extra = {}) {
  try {
    await fetch(`${API_URL}/server-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ serverId, status, ...extra }),
    })
  } catch (err) {
    console.error('[reportStatus] Failed:', err.message)
  }
}

async function sendLog(serverId, level, message) {
  try {
    await fetch(`${API_URL}/server-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ serverId, level, message }),
    })
  } catch {}
}

// ===== Server Lifecycle =====

async function startServer(server) {
  // CRITICAL: Prevent duplicate starts
  if (runningServers.has(server.id)) {
    console.log(`[Server ${server.id}] Already running, ignoring start request`)
    return
  }
  if (startingServers.has(server.id)) {
    console.log(`[Server ${server.id}] Already starting, ignoring duplicate start request`)
    return
  }

  startingServers.add(server.id)
  console.log(`\n[Server ${server.id}] Starting ${server.name} (${server.software} ${server.version})...`)

  const dir = ensureServerDir(server.id)

  // Download server jar
  let jarPath
  try {
    jarPath = await downloadServerJar(server)
  } catch (err) {
    console.error(`[Server ${server.id}] Download failed:`, err.message)
    await reportStatus(server.id, 'error', {})
    await sendLog(server.id, 'error', `Failed to download server: ${err.message}`)
    startingServers.delete(server.id)
    return
  }

  writeFileSync(join(dir, 'eula.txt'), 'eula=true\n')

  // Fetch settings
  let settings = {}
  try {
    const settingsResp = await fetch(`${API_URL}/server-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ serverId: server.id }),
    })
    const detailsData = await settingsResp.json()
    settings = detailsData.server?.server_settings?.[0] || detailsData.server?.server_settings || {}
  } catch (err) {
    console.warn(`[Server ${server.id}] Could not fetch settings:`, err.message)
  }

  const port = await getFreePort(BASE_PORT)
  writeFileSync(join(dir, 'server.properties'), generateServerProperties(settings))

  // Determine Java version
  const javaInfo = findJavaForVersion(server.version)
  console.log(`[Server ${server.id}] Using ${javaInfo.version} for MC ${server.version}`)

  const ramMB = server.ram_limit_mb || 1024
  const isFabric = server.software === 'fabric'
  const jarName = isFabric ? 'fabric-server-launch.jar' : 'server.jar'

  const args = [`-Xmx${ramMB}M`, `-Xms${Math.floor(ramMB / 2)}M`, '-jar', jarName, 'nogui']
  if (port !== BASE_PORT) args.push('--port', String(port))

  console.log(`[Server ${server.id}] Launching: ${javaInfo.path} ${args.join(' ')} (cwd: ${dir})`)

  const proc = spawn(javaInfo.path, args, {
    cwd: dir, stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32' && javaInfo.path.includes(' '),
  })

  const startTime = Date.now()
  let isOnline = false
  const localIP = getLocalIP()
  // Use custom address if set, otherwise use local IP
  const displayAddress = server.custom_address || `${localIP}:${port}`
  let playersOnline = 0

  runningServers.set(server.id, {
    process: proc, port, startTime, address: displayAddress,
    pid: proc.pid, prevCpuTime: 0, playersOnline: 0,
    isRestarting: false, serverId: server.id,
  })

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    for (const line of lines) {
      const trimmed = line.trim()
      let level = 'info'
      if (/ERROR|Exception|Crash/i.test(trimmed)) level = 'error'
      else if (/WARN/i.test(trimmed)) level = 'warning'
      sendLog(server.id, level, trimmed)

      if (!isOnline && /Done \(/i.test(trimmed)) {
        isOnline = true
        console.log(`[Server ${server.id}] Server is online at ${displayAddress}`)
        reportStatus(server.id, 'online', { port, address: displayAddress })
        sendLog(server.id, 'info', `Server is now online at ${displayAddress}`)
      }

      const playerEvent = parsePlayerEvent(trimmed)
      if (playerEvent) {
        if (playerEvent.type === 'join') {
          playersOnline++
          console.log(`[Server ${server.id}] Player joined: ${playerEvent.username}`)
        } else if (playerEvent.type === 'leave') {
          playersOnline = Math.max(0, playersOnline - 1)
          console.log(`[Server ${server.id}] Player left: ${playerEvent.username}`)
        }
        const entry = runningServers.get(server.id)
        if (entry) entry.playersOnline = playersOnline
        reportPlayerEvent(server.id, playerEvent)
        reportStatus(server.id, isOnline ? 'online' : 'starting', { playersOnline })
      }
    }
  })

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    for (const line of lines) sendLog(server.id, 'warning', line.trim())
  })

  proc.on('exit', (code) => {
    console.log(`[Server ${server.id}] Process exited with code ${code}`)
    const wasRestarting = runningServers.get(server.id)?.isRestarting
    runningServers.delete(server.id)
    startingServers.delete(server.id)

    if (wasRestarting) {
      console.log(`[Server ${server.id}] Restarting...`)
      reportStatus(server.id, 'starting', {})
      // Re-fetch server data and start again
      setTimeout(async () => {
        try {
          const resp = await fetch(`${API_URL}/server-details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({ serverId: server.id }),
          })
          const data = await resp.json()
          if (data.server) {
            startServer(data.server)
          } else {
            reportStatus(server.id, 'offline', {})
          }
        } catch (err) {
          console.error(`[Server ${server.id}] Restart failed:`, err.message)
          reportStatus(server.id, 'offline', {})
        }
      }, 2000)
    } else {
      reportStatus(server.id, code === 0 ? 'offline' : 'error', { playersOnline: 0 })
    }
  })

  proc.on('error', (err) => {
    console.error(`[Server ${server.id}] Process error:`, err.message)
    sendLog(server.id, 'error', `Failed to start process: ${err.message}`)
    reportStatus(server.id, 'error', {})
    runningServers.delete(server.id)
    startingServers.delete(server.id)
  })

  await reportStatus(server.id, 'starting', { port, address: displayAddress })

  // Send any pending commands
  const cmds = pendingCommands.get(server.id) || []
  for (const cmd of cmds) proc.stdin.write(cmd + '\n')
  pendingCommands.delete(server.id)

  startingServers.delete(server.id)
}

function stopServer(serverId) {
  const entry = runningServers.get(serverId)
  if (!entry) {
    console.log(`[Server ${serverId}] Not running, marking offline`)
    reportStatus(serverId, 'offline', {})
    return
  }
  console.log(`[Server ${serverId}] Sending stop command...`)
  try {
    entry.process.stdin.write('stop\n')
  } catch {
    try { entry.process.kill('SIGTERM') } catch {}
  }
  setTimeout(() => {
    if (runningServers.has(serverId)) {
      console.log(`[Server ${serverId}] Force killing...`)
      try { entry.process.kill('SIGKILL') } catch {}
      runningServers.delete(serverId)
      reportStatus(serverId, 'offline', {})
    }
  }, 30000)
}

// Restart = stop, wait for exit, then start again
async function restartServer(serverId) {
  const entry = runningServers.get(serverId)
  if (!entry) {
    console.log(`[Server ${serverId}] Not running, just starting...`)
    // Fetch server data and start
    try {
      const resp = await fetch(`${API_URL}/server-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ serverId }),
      })
      const data = await resp.json()
      if (data.server) startServer(data.server)
    } catch (err) {
      console.error(`[Server ${serverId}] Restart-start failed:`, err.message)
      reportStatus(serverId, 'offline', {})
    }
    return
  }

  // Mark as restarting so the exit handler knows to restart
  entry.isRestarting = true
  console.log(`[Server ${serverId}] Restarting (stop then start)...`)
  try {
    entry.process.stdin.write('stop\n')
  } catch {
    try { entry.process.kill('SIGTERM') } catch {}
  }
  // Safety timeout: if process doesn't exit in 30s, force kill
  setTimeout(() => {
    if (runningServers.has(serverId)) {
      const e = runningServers.get(serverId)
      if (e && e.isRestarting) {
        console.log(`[Server ${serverId}] Force killing for restart...`)
        try { e.process.kill('SIGKILL') } catch {}
      }
    }
  }, 30000)
}

// Send command to Minecraft process stdin — does NOT write a log entry
function sendCommand(serverId, command) {
  const entry = runningServers.get(serverId)
  if (entry && entry.process.stdin.writable) {
    entry.process.stdin.write(command + '\n')
    console.log(`[Server ${serverId}] Sent command to process: ${command}`)
  } else {
    const cmds = pendingCommands.get(serverId) || []
    cmds.push(command)
    pendingCommands.set(serverId, cmds)
    console.log(`[Server ${serverId}] Queued command (server not running): ${command}`)
  }
}

// ===== Command polling (per-server cursor, no infinite loops) =====

async function pollCommands() {
  if (!nodeId || shuttingDown) return
  if (runningServers.size === 0) return

  for (const [serverId] of runningServers) {
    try {
      const cursor = serverCursors.get(serverId) || new Date(0).toISOString()
      const resp = await fetch(`${API_URL}/pending-commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ serverId, since: cursor }),
      })
      const data = await resp.json()
      if (data.commands && data.commands.length > 0) {
        let latestTime = cursor
        for (const cmd of data.commands) {
          if (processedCommandIds.has(cmd.id)) continue
          processedCommandIds.add(cmd.id)
          if (processedCommandIds.size > 500) {
            const arr = Array.from(processedCommandIds)
            processedCommandIds.clear()
            arr.slice(-200).forEach(id => processedCommandIds.add(id))
          }
          const commandText = cmd.message.replace(/^>\s*/, '')
          console.log(`[Server ${serverId}] Executing command from web: ${commandText}`)
          sendCommand(serverId, commandText)
          if (cmd.created_at && cmd.created_at > latestTime) {
            latestTime = cmd.created_at
          }
        }
        serverCursors.set(serverId, latestTime)
      }
    } catch {}
  }
}

// ===== Heartbeat =====

async function heartbeat() {
  if (!nodeId || shuttingDown) return

  // Step 1: Fetch pending actions FIRST
  let pendingActions = []
  try {
    const resp = await fetch(`${API_URL}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({
        nodeId,
        usedRamMb: 0,
        usedCpuPercent: 0,
        usedStorageMb: 0,
        totalServers: runningServers.size,
      }),
    })
    const data = await resp.json()
    pendingActions = data.pendingActions || []
  } catch (err) {
    console.error('[heartbeat] Failed:', err.message)
  }

  // Step 2: Process pending actions
  for (const server of pendingActions) {
    if (server.status === 'starting' && !runningServers.has(server.id) && !startingServers.has(server.id)) {
      startServer(server)
    } else if (server.status === 'stopping' && runningServers.has(server.id)) {
      stopServer(server.id)
    } else if (server.status === 'creating') {
      reportStatus(server.id, 'offline', {})
    }
  }

  // Step 3: Update metrics ONLY for servers still running and not just stopped
  for (const [serverId, entry] of runningServers) {
    const wasJustStopped = pendingActions.some(s => s.id === serverId && s.status === 'stopping')
    if (wasJustStopped) continue

    const metrics = await getRealMetrics(entry)
    const uptime = Math.floor((Date.now() - entry.startTime) / 1000)
    try {
      await fetch(`${API_URL}/server-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          serverId,
          status: 'online',
          uptimeSeconds: uptime,
          playersOnline: entry.playersOnline || 0,
          cpuUsage: metrics.cpu,
          ramUsageMb: metrics.ram,
          storageUsageMb: metrics.storageMb,
          networkInKbps: metrics.netInKbps,
          networkOutKbps: metrics.netOutKbps,
        }),
      })
    } catch {}
  }
}

async function getDirSize(dir) {
  let size = 0
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) size += await getDirSize(path)
    else size += stat.size
  }
  return size
}

// ===== File Server =====

const fileServer = createHttpServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }
  if (req.method !== 'POST') { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); return }

  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', async () => {
    try {
      const { serverId, path: reqPath, action, content, binary } = JSON.parse(body)
      const serverDir = getServerDir(serverId)
      const safePath = normalize(reqPath || '/').replace(/^(\.\.[/\\])+/, '')
      const fullPath = join(serverDir, safePath)
      if (!fullPath.startsWith(serverDir)) {
        res.writeHead(403); res.end(JSON.stringify({ error: 'Path outside server directory' })); return
      }
      switch (action) {
        case 'list': {
          if (!existsSync(fullPath)) { res.writeHead(200); res.end(JSON.stringify({ files: [] })); return }
          const entries = readdirSync(fullPath)
          const files = entries.map(name => {
            const p = join(fullPath, name)
            const stat = statSync(p)
            return { name, path: safePath === '/' ? `/${name}` : `${safePath}/${name}`, isDirectory: stat.isDirectory(), size: stat.size, modified: stat.mtime.toISOString() }
          })
          res.writeHead(200); res.end(JSON.stringify({ files })); break
        }
        case 'read': {
          if (!existsSync(fullPath)) { res.writeHead(404); res.end(JSON.stringify({ error: 'File not found' })); return }
          const data = readFileSync(fullPath, 'utf-8')
          res.writeHead(200); res.end(JSON.stringify({ content: data })); break
        }
        case 'write': {
          ensureServerDir(serverId)
          const dir = dirname(fullPath)
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
          if (binary) writeFileSync(fullPath, Buffer.from(content, 'base64'))
          else writeFileSync(fullPath, content, 'utf-8')
          res.writeHead(200); res.end(JSON.stringify({ ok: true })); break
        }
        case 'create': { ensureServerDir(serverId); writeFileSync(fullPath, '', 'utf-8'); res.writeHead(200); res.end(JSON.stringify({ ok: true })); break }
        case 'mkdir': { ensureServerDir(serverId); if (!existsSync(fullPath)) mkdirSync(fullPath, { recursive: true }); res.writeHead(200); res.end(JSON.stringify({ ok: true })); break }
        case 'delete': {
          if (existsSync(fullPath)) {
            const stat = statSync(fullPath)
            if (stat.isDirectory()) rmdirSync(fullPath, { recursive: true })
            else unlinkSync(fullPath)
          }
          res.writeHead(200); res.end(JSON.stringify({ ok: true })); break
        }
        default: res.writeHead(400); res.end(JSON.stringify({ error: 'Unknown action' }))
      }
    } catch (err) {
      res.writeHead(500); res.end(JSON.stringify({ error: err.message }))
    }
  })
})

// ===== Registration =====

async function register() {
  const javaVersion = checkJava()
  const localIP = getLocalIP()

  if (!javaVersion) {
    console.error('\n[WARNING] Java not found! Minecraft servers require Java.')
    console.error('Install Java from: https://adoptium.net/\n')
  } else {
    const major = getJavaMajorVersion(javaVersion)
    console.log(`[INFO] Java version: ${javaVersion} (major: ${major})`)
    if (major < 17) {
      console.warn(`[WARNING] Java ${major} detected. MC 1.18+ requires Java 17+.`)
      console.warn('[WARNING] Install Java 17+ from https://adoptium.net/ to play newer versions.\n')
    }
  }

  console.log(`[INFO] Local IP: ${localIP}`)
  console.log(`[INFO] Node name: ${NODE_NAME}`)
  console.log(`[INFO] Servers directory: ${SERVERS_DIR}`)
  console.log(`[INFO] File server port: ${NODE_PORT}`)

  const freeMem = Math.floor(freemem() / (1024 * 1024))

  try {
    const resp = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({
        name: NODE_NAME,
        publicAddress: `http://${localIP}:${NODE_PORT}`,
        availableRamMb: Math.min(freeMem, 4096),
        availableCpuPercent: 100,
        availableStorageMb: 5120,
        javaVersion,
        dockerAvailable: false,
      }),
    })
    const data = await resp.json()
    if (!resp.ok || !data.nodeId) throw new Error(data.error || `Registration failed (HTTP ${resp.status})`)
    nodeId = data.nodeId
    console.log(`\n[SUCCESS] Node registered! ID: ${nodeId}`)
    console.log(`[INFO] CubeForge is connected. Start/stop servers from the dashboard!`)
    console.log(`[INFO] This agent stays running. Press Ctrl+C to disconnect.\n`)
  } catch (err) {
    console.error('[FATAL] Registration failed:', err.message)
    process.exit(1)
  }
}

// ===== Shutdown =====

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  console.log('\n[INFO] Shutting down...')
  for (const [serverId, entry] of runningServers) {
    console.log(`[Server ${serverId}] Stopping...`)
    try { entry.process.stdin.write('stop\n') } catch {}
    reportStatus(serverId, 'offline', { playersOnline: 0 })
  }
  await new Promise(resolve => setTimeout(resolve, 3000))
  for (const [serverId, entry] of runningServers) {
    try { entry.process.kill('SIGKILL') } catch {}
  }
  runningServers.clear()
  if (nodeId) {
    try {
      await fetch(`${API_URL}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ nodeId, status: 'offline', usedRamMb: 0, usedCpuPercent: 0, usedStorageMb: 0, totalServers: 0 }),
      })
      console.log('[INFO] Node marked as offline.')
    } catch (err) {
      console.error('[INFO] Could not mark node offline:', err.message)
    }
  }
  setTimeout(() => process.exit(0), 1000)
}

// ===== Main =====

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║       CubeForge Node Agent v4.0          ║')
  console.log('║   Free Minecraft Server Hosting          ║')
  console.log('╚══════════════════════════════════════════╝\n')

  if (!existsSync(SERVERS_DIR)) mkdirSync(SERVERS_DIR, { recursive: true })

  await register()

  // Clean up stale servers on startup (reset starting/stopping to offline)
  try {
    const resp = await fetch(`${API_URL}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ nodeId, usedRamMb: 0, usedCpuPercent: 0, usedStorageMb: 0, totalServers: 0 }),
    })
    const data = await resp.json()
    if (data.pendingActions) {
      for (const server of data.pendingActions) {
        if (server.status === 'starting' || server.status === 'stopping') {
          console.log(`[Server ${server.id}] Resetting stale ${server.status} status to offline`)
          reportStatus(server.id, 'offline', {})
        } else if (server.status === 'creating') {
          reportStatus(server.id, 'offline', {})
        }
      }
    }
  } catch {}

  fileServer.listen(NODE_PORT, () => {
    console.log(`[INFO] File server running on port ${NODE_PORT}`)
  })

  console.log(`[INFO] Heartbeat every ${HEARTBEAT_INTERVAL / 1000}s, command poll every ${COMMAND_POLL_INTERVAL / 1000}s`)
  heartbeat()
  setInterval(heartbeat, HEARTBEAT_INTERVAL)
  setInterval(pollCommands, COMMAND_POLL_INTERVAL)

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1) })
