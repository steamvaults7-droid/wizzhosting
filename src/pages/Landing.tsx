import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  motion, AnimatePresence,
  useInView, useMotionValue, animate,
} from 'framer-motion'
import {
  ArrowRight, Cpu, MemoryStick, Users, Wifi,
  Server, Monitor, Activity, FileCode, Boxes, Terminal,
  Menu, X, Zap, HardDrive, PlayCircle, Download, ShieldCheck,
  AlertTriangle, CheckCircle2, Clock3, RefreshCw, KeyRound,
  ExternalLink, LockKeyhole, CircleHelp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ===== NAVBAR =====
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { label: 'Home', href: '#top' },
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Node Agent', href: '#node-agent' },
    { label: 'Pricing', href: '#pricing' },
  ]

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-background/70 backdrop-blur-xl border-b border-border/60'
            : 'bg-transparent border-b border-transparent'
        )}
      >
        <div className="container mx-auto flex items-center justify-between px-6 h-16">
          {/* Logo */}
          <a href="#top" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
              <Boxes className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Wizz<span className="text-primary">Hosting</span>
            </span>
          </a>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-muted-foreground hover:text-foreground transition-colors relative group"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Get Started <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-md border border-border"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-xl border-b border-border"
          >
            <nav className="container mx-auto px-6 py-6 flex flex-col gap-4">
              {navLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-base text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  {l.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                <Button variant="outline" asChild>
                  <Link to="/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link to="/register" onClick={() => setMobileOpen(false)}>Get Started <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ===== ANIMATED NUMBER =====
function AnimatedNumber({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const count = useMotionValue(0)
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (!inView) return
    const controls = animate(count, value, {
      duration: 1.5,
      ease: 'easeOut',
      onUpdate: (latest) => {
        setDisplay(latest.toFixed(decimals))
      },
    })
    return () => controls.stop()
  }, [inView, value, decimals, count])

  return <span ref={ref}>{display}{suffix}</span>
}

// ===== HERO VISUAL =====
function HeroVisual() {
  const cards = [
    { icon: Cpu, label: 'CPU', value: '24%', color: 'text-primary', delay: 0, x: -1, y: -1 },
    { icon: MemoryStick, label: 'RAM', value: '3.4 GB', color: 'text-blue-400', delay: 0.3, x: 1, y: -1 },
    { icon: Users, label: 'PLAYERS', value: '12', color: 'text-emerald-400', delay: 0.6, x: -1, y: 1 },
    { icon: Wifi, label: 'STATUS', value: 'ONLINE', color: 'text-primary', delay: 0.9, x: 1, y: 1 },
  ]

  return (
    <div className="relative w-full max-w-2xl mx-auto aspect-square max-h-[480px]">
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-primary/10 rounded-full blur-[100px]" />

      {/* Floating metric cards */}
      {cards.map((card, i) => {
        const posStyle = card.x === -1 ? 'left-0' : 'right-0'
        const posY = card.y === -1 ? 'top-0' : 'bottom-0'
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + card.delay, duration: 0.4 }}
            className={cn('absolute z-20', posStyle, posY)}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
              className="px-4 py-3 rounded-xl bg-card/80 backdrop-blur-sm border border-border/60 shadow-lg min-w-[100px]"
            >
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={cn('h-3.5 w-3.5', card.color)} />
                <span className="text-[10px] font-medium text-muted-foreground tracking-wider">{card.label}</span>
              </div>
              <p className="text-sm font-bold font-mono">{card.value}</p>
            </motion.div>
          </motion.div>
        )
      })}

      {/* Center node + connection lines */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400" fill="none">
          {/* Connection lines */}
          <line x1="200" y1="140" x2="200" y2="80" stroke="hsl(258 90% 66% / 0.3)" strokeWidth="1.5" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" values="0;-16" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="200" y1="260" x2="200" y2="320" stroke="hsl(258 90% 66% / 0.3)" strokeWidth="1.5" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" values="0;-16" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="140" y1="200" x2="80" y2="200" stroke="hsl(258 90% 66% / 0.3)" strokeWidth="1.5" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" values="0;-16" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="260" y1="200" x2="320" y2="200" stroke="hsl(258 90% 66% / 0.3)" strokeWidth="1.5" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" values="0;-16" dur="2s" repeatCount="indefinite" />
          </line>

          {/* Particles traveling along lines */}
          <circle r="2.5" fill="hsl(258 90% 66%)">
            <animateMotion dur="2s" repeatCount="indefinite" path="M 200 80 L 200 140" />
          </circle>
          <circle r="2.5" fill="hsl(258 90% 66%)">
            <animateMotion dur="2s" repeatCount="indefinite" begin="0.5s" path="M 200 260 L 200 320" />
          </circle>
          <circle r="2.5" fill="hsl(258 90% 66%)">
            <animateMotion dur="2s" repeatCount="indefinite" begin="1s" path="M 80 200 L 140 200" />
          </circle>
          <circle r="2.5" fill="hsl(258 90% 66%)">
            <animateMotion dur="2s" repeatCount="indefinite" begin="1.5s" path="M 320 200 L 260 200" />
          </circle>
        </svg>

        {/* Center: WizzHosting Control */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="relative z-10"
        >
          <div className="px-5 py-4 rounded-2xl bg-card border border-primary/30 violet-glow">
            <div className="flex items-center gap-2 mb-1">
              <Boxes className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary tracking-wide">WizzHosting</span>
            </div>
            <p className="text-sm font-bold">Control</p>
          </div>
        </motion.div>

        {/* Top: Node Agent */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="absolute top-[12%] left-1/2 -translate-x-1/2 z-10"
        >
          <div className="px-4 py-2.5 rounded-xl bg-secondary/80 border border-border backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Wizz Node Agent</span>
            </div>
          </div>
        </motion.div>

        {/* Bottom: Your Machine */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-[12%] left-1/2 -translate-x-1/2 z-10"
        >
          <div className="px-4 py-2.5 rounded-xl bg-secondary/80 border border-border backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Your Machine</span>
            </div>
          </div>
        </motion.div>

        {/* Left: Minecraft Server */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.0 }}
          className="absolute left-[8%] top-1/2 -translate-y-1/2 z-10"
        >
          <div className="px-3 py-2 rounded-lg bg-secondary/80 border border-border backdrop-blur-sm">
            <span className="text-[10px] font-medium text-muted-foreground">Minecraft</span>
          </div>
        </motion.div>

        {/* Right: Real-time */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.1 }}
          className="absolute right-[8%] top-1/2 -translate-y-1/2 z-10"
        >
          <div className="px-3 py-2 rounded-lg bg-secondary/80 border border-border backdrop-blur-sm">
            <span className="text-[10px] font-medium text-muted-foreground">Real-time</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ===== HERO =====
function Hero() {
  return (
    <section id="top" className="relative pt-32 pb-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/8 rounded-full blur-[120px]" />

      <div className="container mx-auto px-6 relative">
        <div className="max-w-5xl mx-auto text-center">
          {/* Pill */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              LOCAL INFRASTRUCTURE • COMPLETE CONTROL
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold font-display tracking-tight leading-[1.05] mb-6"
          >
            Your hardware.
            <br />
            Your Minecraft <span className="text-gradient">servers.</span>
          </motion.h1>

          {/* Supporting text */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8"
          >
            Turn your own machine into powerful Minecraft infrastructure. Create, manage and monitor
            your servers through WizzHosting's modern control platform.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
          >
            <Button size="lg" asChild className="group">
              <Link to="/register">
                Create Your Server
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">
                <PlayCircle className="h-4 w-4" />
                See How It Works
              </a>
            </Button>
          </motion.div>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-muted-foreground"
          >
            Powered by the WizzHosting Node Agent
          </motion.p>
        </div>

        {/* Hero visual */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  )
}

// ===== TRUST STRIP =====
function TrustStrip() {
  const labels = ['LOCAL HOSTING', 'NODE AGENTS', 'REAL-TIME MONITORING', 'FULL CONTROL']
  return (
    <section className="py-12 border-y border-border/50">
      <div className="container mx-auto px-6">
        <p className="text-center text-sm text-muted-foreground mb-8">
          Built for creators, developers and Minecraft server owners.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {labels.map((label, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2"
            >
              <span className="h-1 w-1 rounded-full bg-primary" />
              <span className="text-xs font-medium text-muted-foreground tracking-wider">{label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ===== FEATURES =====
const FEATURES = [
  { icon: Server, title: 'Local Hosting', desc: 'Run Minecraft servers directly on hardware you control.' },
  { icon: Monitor, title: 'Node Management', desc: 'Connect your machines and manage them from a central platform.' },
  { icon: Activity, title: 'Real-Time Monitoring', desc: 'See CPU, RAM, disk and network usage in real time.' },
  { icon: Zap, title: 'Server Controls', desc: 'Start, stop and restart your servers instantly.' },
  { icon: Terminal, title: 'Web Console', desc: 'Access your Minecraft server console directly from your browser.' },
  { icon: FileCode, title: 'File Management', desc: 'Manage your server files without leaving WizzHosting.' },
]

function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="container mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight">Everything your server needs.</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            WizzHosting puts your infrastructure under your control.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: (i % 3) * 0.1 }}
              whileHover={{ y: -4 }}
              className="group p-6 rounded-xl border border-border bg-card/40 hover:border-primary/30 hover:bg-card/60 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ===== PRODUCT SHOWCASE =====
function ProductShowcase() {
  const sidebarItems = ['Overview', 'Servers', 'Nodes', 'Backups', 'Files']
  const metrics = [
    { label: 'CPU', value: 21, suffix: '%', decimals: 0, icon: Cpu },
    { label: 'RAM', value: 3.2, suffix: ' GB', decimals: 1, icon: MemoryStick },
    { label: 'DISK', value: 18.4, suffix: ' GB', decimals: 1, icon: HardDrive },
    { label: 'PLAYERS', value: 12, suffix: ' / 50', decimals: 0, icon: Users },
  ]

  const consoleLines = [
    { text: '[Server] Starting Minecraft server...', type: 'info' },
    { text: '[Server] Loading properties', type: 'info' },
    { text: '[Server] Preparing level "world"', type: 'info' },
    { text: '[Server] Done (3.842s)! For help, type "help"', type: 'success' },
    { text: '[Server] Player Steve joined the game', type: 'info' },
    { text: '> say Welcome to the server!', type: 'command' },
  ]

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight">Control your server from anywhere.</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="rounded-2xl border border-border bg-card/60 overflow-hidden shadow-2xl shadow-primary/5">
            {/* Window bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/40">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-warning/60" />
                <div className="h-3 w-3 rounded-full bg-success/60" />
              </div>
              <span className="text-xs text-muted-foreground ml-2 font-mono">wizzhosting.com/server/survival-smp</span>
            </div>

            <div className="flex">
              {/* Sidebar */}
              <div className="hidden sm:flex flex-col gap-1 p-4 border-r border-border bg-secondary/20 min-w-[140px]">
                {sidebarItems.map((item, i) => (
                  <div
                    key={item}
                    className={cn(
                      'px-3 py-2 rounded-md text-xs font-medium transition-colors',
                      i === 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {item}
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 p-6">
                {/* Server header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Survival SMP</h3>
                    <p className="text-xs text-muted-foreground font-mono">play.example.com</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <span className="text-xs font-medium text-success">ONLINE</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {metrics.map((m, i) => (
                    <div key={m.label} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <m.icon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground tracking-wider">{m.label}</span>
                      </div>
                      <p className="text-sm font-bold font-mono">
                        <AnimatedNumber value={m.value} suffix={m.suffix} decimals={m.decimals} />
                      </p>
                    </div>
                  ))}
                </div>

                {/* Console preview */}
                <div className="rounded-lg border border-border bg-background/60 p-3 h-[160px] overflow-hidden font-mono text-xs">
                  {consoleLines.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.15 }}
                      className={cn(
                        'leading-relaxed',
                        line.type === 'success' && 'text-success',
                        line.type === 'command' && 'text-primary',
                        line.type === 'info' && 'text-muted-foreground'
                      )}
                    >
                      {line.text}
                    </motion.div>
                  ))}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-2 h-3.5 bg-primary align-middle"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ===== HOW IT WORKS =====
const STEPS = [
  { num: '01', title: 'Install the Agent', desc: 'Install the lightweight WizzHosting Node Agent on your machine.' },
  { num: '02', title: 'Connect Your Node', desc: 'Securely connect your machine to WizzHosting.' },
  { num: '03', title: 'Start Hosting', desc: 'Create your Minecraft server and start playing.' },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 border-y border-border/50 bg-secondary/10">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight">From machine to Minecraft server.</h2>
        </motion.div>

        <div className="max-w-4xl mx-auto relative">
          {/* Animated connecting line */}
          <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-px">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 origin-left"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.3 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-card border border-primary/20 flex items-center justify-center mb-5 violet-glow">
                  <span className="text-lg font-bold text-primary font-mono">{step.num}</span>
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground max-w-[240px]">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ===== NODE AGENT / TERMINAL =====
function TerminalSection() {
  const commands = [
    { cmd: '$ wizz-agent install', output: 'Installing WizzHosting Node Agent v5.0...' },
    { cmd: '$ wizz-agent login', output: 'Authenticated successfully.' },
    { cmd: '$ wizz-agent connect', output: 'Node connected. Waiting for server commands...' },
  ]

  return (
    <section className="py-24 bg-secondary/15 border-y border-border/50">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold font-display tracking-tight mb-4">Your machine becomes the server.</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              WizzHosting connects your local hardware to a powerful management interface through
              the WizzHosting Node Agent.
            </p>
            <p className="text-sm text-primary font-medium">Lightweight. Secure. Built for control.</p>
          </motion.div>

          {/* Terminal window */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-border bg-background/80 overflow-hidden shadow-2xl shadow-primary/5"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/40">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
              </div>
              <span className="text-xs text-muted-foreground ml-2 font-mono">Terminal — wizz-agent</span>
            </div>
            <div className="p-4 font-mono text-xs space-y-3 min-h-[180px]">
              {commands.map((c, i) => (
                <TerminalLine key={i} cmd={c.cmd} output={c.output} delay={i * 0.4} />
              ))}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-2 h-3.5 bg-primary align-middle"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function TerminalLine({ cmd, output, delay }: { cmd: string; output: string; delay: number }) {
  const [typed, setTyped] = useState('')
  const [showOutput, setShowOutput] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-30px' })

  useEffect(() => {
    if (!inView) return
    let i = 0
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        i++
        setTyped(cmd.slice(0, i))
        if (i >= cmd.length) {
          clearInterval(interval)
          setTimeout(() => setShowOutput(true), 300)
        }
      }, 40)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [inView, cmd, delay])

  return (
    <div ref={ref}>
      <div className="text-primary">{typed}<span className="text-muted-foreground">{typed.length < cmd.length ? '▋' : ''}</span></div>
      {showOutput && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground mt-0.5"
        >
          {output}
        </motion.div>
      )}
    </div>
  )
}

// ===== NODE AGENT GUIDE =====
type AgentTab = 'overview' | 'install' | 'connect' | 'safety'

function NodeAgentSection() {
  const [activeTab, setActiveTab] = useState<AgentTab>('overview')
  const downloadPath = '/downloads/wizzhosting-node-agent-v5.0-2026-10-05.zip'

  const tabs: { id: AgentTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'install', label: 'Install' },
    { id: 'connect', label: 'Connect' },
    { id: 'safety', label: 'Safety' },
  ]

  return (
    <section id="node-agent" className="py-24 border-y border-border/50 bg-secondary/10 scroll-mt-16">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
                <Monitor className="h-3.5 w-3.5" />
                WIZZHOSTING NODE AGENT
              </div>
              <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight">Everything you need to connect.</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
                The Node Agent runs on your computer, reports its resources securely, and receives server actions from your WizzHosting dashboard.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 shrink-0">
              <div className="h-9 w-9 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current release</p>
                <p className="text-sm font-semibold font-mono">v5.0 · 05 Oct 2026</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden shadow-2xl shadow-primary/5">
            <div className="flex overflow-x-auto border-b border-border bg-secondary/30 p-2 gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    activeTab === tab.id
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8 min-h-[330px]">
              {activeTab === 'overview' && (
                <div className="grid md:grid-cols-[1.15fr_0.85fr] gap-8 items-start">
                  <div>
                    <h3 className="text-xl font-semibold mb-3">Your machine, managed from anywhere.</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                      Keep the agent running while you use your dashboard. It connects your own hardware to WizzHosting so you can monitor resources, manage files, and control Minecraft servers without renting a separate machine.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        { icon: Cpu, title: 'Resource reporting', desc: 'CPU, memory, disk and network metrics.' },
                        { icon: Terminal, title: 'Server controls', desc: 'Start, stop, restart and use the console.' },
                        { icon: LockKeyhole, title: 'Outbound connection', desc: 'The agent initiates its dashboard connection.' },
                        { icon: RefreshCw, title: 'Live heartbeats', desc: 'Online status refreshes every few seconds.' },
                      ].map((item) => (
                        <div key={item.title} className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                          <item.icon className="h-4 w-4 text-primary mb-3" />
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-5">
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-xs text-muted-foreground font-mono">agent-release.json</span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />Current</span>
                    </div>
                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">version</span><span>5.0.0</span></div>
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">platforms</span><span>Windows · macOS · Linux</span></div>
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">updated</span><span>2026-10-05</span></div>
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">package</span><span>13,492 bytes</span></div>
                    </div>
                    <Button className="w-full mt-6" asChild>
                      <a href={downloadPath} download><Download className="h-4 w-4" />Download v5.0</a>
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'install' && (
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Install on Windows</h3>
                    <ol className="space-y-4">
                      {[
                        ['01', 'Download the current agent', 'Save the ZIP file, then extract it into a new folder.'],
                        ['02', 'Install Node.js LTS', 'The agent needs Node.js installed and available from the Windows command line.'],
                        ['03', 'Run as Administrator', 'Right-click start-windows.bat and choose Run as administrator.'],
                        ['04', 'Keep the window open', 'The agent is active while this window is running.'],
                      ].map(([number, title, description]) => (
                        <li key={number} className="flex gap-4">
                          <span className="font-mono text-xs text-primary pt-1">{number}</span>
                          <div><p className="text-sm font-medium">{title}</p><p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p></div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-xl border-2 border-destructive/50 bg-destructive/10 p-5">
                      <div className="flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                        <div>
                          <p className="font-semibold text-destructive">Windows: Run as Administrator</p>
                          <p className="text-sm text-foreground/80 mt-2 leading-relaxed">This is important so the agent can access its local server files and reserve the ports Minecraft needs.</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-secondary/20 p-5">
                      <div className="flex items-center gap-2 mb-2"><CircleHelp className="h-4 w-4 text-primary" /><p className="text-sm font-medium">What if the window closes?</p></div>
                      <p className="text-sm text-muted-foreground leading-relaxed">Use the newest download above. The launcher stays open and shows the actual error instead of closing silently.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'connect' && (
                <div>
                  <h3 className="text-xl font-semibold mb-2">Connect your node</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mb-7">After the agent starts, it registers this computer with your account. Return to the dashboard and open Nodes to confirm it is online before creating a server.</p>
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { icon: Download, number: '1', title: 'Start the agent', desc: 'Launch the platform file from the extracted folder.' },
                      { icon: KeyRound, number: '2', title: 'Authenticate', desc: 'The agent uses the settings supplied in its local configuration.' },
                      { icon: CheckCircle2, number: '3', title: 'Confirm online', desc: 'The dashboard shows the node as connected and ready.' },
                    ].map((step) => (
                      <div key={step.number} className="rounded-xl border border-border bg-secondary/20 p-5">
                        <div className="flex items-center justify-between mb-5"><step.icon className="h-5 w-5 text-primary" /><span className="font-mono text-xs text-muted-foreground">STEP {step.number}</span></div>
                        <p className="font-medium">{step.title}</p><p className="text-sm text-muted-foreground mt-2 leading-relaxed">{step.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'safety' && (
                <div className="grid md:grid-cols-[1fr_0.9fr] gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-3">Download and verify safely.</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">Only download the agent from the WizzHosting dashboard. Before opening it, you can upload the ZIP to VirusTotal for an independent scan.</p>
                    <div className="space-y-3">
                      {[
                        'Download the ZIP from this page, not from a third-party mirror.',
                        'Check that the version and file size match the release details above.',
                        'Scan the ZIP with your antivirus before extracting it.',
                        'Never share your local configuration file or connection credentials.',
                      ].map((item) => <div key={item} className="flex gap-3 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />{item}</div>)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-5">
                    <div className="flex items-center gap-3 mb-4"><ShieldCheck className="h-6 w-6 text-primary" /><div><p className="font-semibold">VirusTotal verification</p><p className="text-xs text-muted-foreground">Independent scan guidance · Java 21 for 1.20.5–1.21.x · Java 25 for 26.1</p></div></div>
                    <div className="rounded-lg border border-success/30 bg-success/10 p-4 mb-4">
                      <div className="flex gap-3">
                        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-success">0 of 65 vendors flagged the previous v4.0 file</p>
                          <p className="text-xs text-foreground/70 mt-1">The current v5.0 archive has a different checksum and is awaiting its own scan.</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4 text-xs font-mono text-muted-foreground break-all">
                      <p><span className="text-foreground/60">scanned file:</span> wizzhosting-node-agent-2026-10-05.zip</p>
                      <p><span className="text-foreground/60">sha256:</span> f1005ad3c51559da1c4fa7b894e6863d09660c608a8f8cc3f8166d21b96d8457</p>
                    </div>
                    <a href="https://www.virustotal.com/gui/file/f1005ad3c51559da1c4fa7b894e6863d09660c608a8f8cc3f8166d21b96d8457/details" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">View official VirusTotal report <ExternalLink className="h-3.5 w-3.5" /></a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ===== BIG VISUAL STATEMENT =====
function BigStatement() {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="container mx-auto px-6 relative text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl font-bold font-display tracking-tight leading-[1.1]"
        >
          Why rent hardware
          <br />
          when you already own it?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-lg text-muted-foreground max-w-xl mx-auto"
        >
          WizzHosting gives you the tools to turn your own machine into Minecraft infrastructure.
        </motion.p>
      </div>
    </section>
  )
}

// ===== FINAL CTA =====
function FinalCTA() {
  return (
    <section id="pricing" className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          className="max-w-3xl mx-auto text-center relative"
        >
          {/* Glow */}
          <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-[80px]" />

          <div className="relative p-12 rounded-3xl border border-border bg-card/40">
            <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight mb-4">
              Ready to host your way?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8">
              Connect your machine and start building your Minecraft infrastructure with WizzHosting.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="group">
                <Link to="/register">
                  Get Started
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">Learn More</a>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ===== FOOTER =====
function Footer() {
  const links = ['Product', 'Features', 'Pricing', 'Status', 'Support']
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Boxes className="h-4 w-4 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Wizz<span className="text-primary">Hosting</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            {links.map((l) => (
              <a key={l} href="#" className="hover:text-foreground transition-colors">{l}</a>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">© 2026 WizzHosting</p>
        </div>
      </div>
    </footer>
  )
}

// ===== MAIN =====
export default function Landing() {
  return (
    <div className="min-h-screen bg-background bg-noise">
      <Navbar />
      <Hero />
      <TrustStrip />
      <Features />
      <ProductShowcase />
      <HowItWorks />
      <TerminalSection />
      <NodeAgentSection />
      <BigStatement />
      <FinalCTA />
      <Footer />
    </div>
  )
}
