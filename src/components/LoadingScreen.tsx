import { motion, AnimatePresence } from 'framer-motion'
import { Boxes } from 'lucide-react'

export default function LoadingScreen({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
        >
          {/* Subtle grid */}
          <div className="absolute inset-0 bg-grid opacity-20" />
          {/* Violet glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl" />

          <div className="relative flex flex-col items-center gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex items-center gap-3"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Boxes className="h-6 w-6 text-primary" />
              </div>
              <span className="text-2xl font-bold font-display tracking-tight">
                Wizz<span className="text-primary">Hosting</span>
              </span>
            </motion.div>

            {/* Animated bar */}
            <div className="w-48 h-1 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="h-full w-1/2 rounded-full bg-primary"
              />
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xs text-muted-foreground font-mono"
            >
              Initializing infrastructure...
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
