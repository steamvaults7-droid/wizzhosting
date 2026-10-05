import { useState, useEffect } from 'react'
import { User, Mail, Shield, Loader2, Save } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FREE_TIER_LIMITS } from '@/types'

export default function Settings() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const [username, setUsername] = useState(user?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [serverCount, setServerCount] = useState(0)

  useEffect(() => {
    supabase.from('servers').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setServerCount(count ?? 0)
    })
  }, [])

  async function handleSave() {
    if (username.length < 3) {
      toast('error', 'Username too short')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', user?.id)
    setSaving(false)
    if (error) {
      toast('error', 'Update failed', error.message)
    } else {
      updateUser({ username })
      toast('success', 'Profile updated')
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Settings</h1>
      <p className="text-muted-foreground text-sm mb-8">Manage your account and preferences</p>

      {/* Profile */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary" />Profile</CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{user?.username}</p>
              <p className="text-sm text-muted-foreground">Member since {new Date(user?.created_at ?? '').toLocaleDateString()}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Mail className="h-4 w-4" />Email</Label>
            <Input value={user?.email ?? ''} disabled className="opacity-60" />
          </div>
          <Button onClick={handleSave} disabled={saving || username === user?.username}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Account</CardTitle>
          <CardDescription>Your account details and limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="secondary" className="capitalize">{user?.role}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email verified</span>
            <Badge variant={user?.email_verified ? 'success' : 'warning'}>
              {user?.email_verified ? 'Verified' : 'Pending'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Servers</span>
            <span className="text-sm font-medium">{serverCount} / {FREE_TIER_LIMITS.maxServers}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">RAM limit</span>
            <span className="text-sm font-medium">{FREE_TIER_LIMITS.maxRamMb / 1024} GB</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Storage limit</span>
            <span className="text-sm font-medium">{FREE_TIER_LIMITS.maxStorageMb / 1024} GB</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
