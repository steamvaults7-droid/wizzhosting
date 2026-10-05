import { Link } from 'react-router-dom'
import { Boxes, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSize = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-xl'

  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <div className={`${iconSize} rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors`}>
        <Boxes className={size === 'sm' ? 'h-4 w-4 text-primary' : 'h-5 w-5 text-primary'} />
      </div>
      <span className={`${textSize} font-bold font-display tracking-tight`}>
        Wizz<span className="text-primary">Hosting</span>
      </span>
    </Link>
  )
}

export function LandingNav() {
  return (
    <nav className="flex items-center gap-3">
      <Button variant="ghost" asChild>
        <Link to="/login">Login</Link>
      </Button>
      <Button asChild>
        <Link to="/register">Get Started →</Link>
      </Button>
    </nav>
  )
}
