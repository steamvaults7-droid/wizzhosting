import { Link } from 'react-router-dom'
import { MailCheck, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function VerifyEmail() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (user?.email_verified) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <MailCheck className="h-12 w-12 text-success mx-auto mb-2" />
          <CardTitle className="text-2xl">Email verified</CardTitle>
          <CardDescription>Your email has been verified. You're all set!</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <CardHeader className="text-center">
        <MailCheck className="h-12 w-12 text-primary mx-auto mb-2" />
        <CardTitle className="text-2xl">Verify your email</CardTitle>
        <CardDescription>
          We sent a verification link to your email. Click it to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Already verified? You may need to sign in again.
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link to="/dashboard">Continue to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/login">Sign in again</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
