import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BlurFade } from "@/components/ui/blur-fade";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Mail, Calendar, Shield, LogOut, CheckCircle2 } from "lucide-react";

// Force dynamic rendering for auth
export const dynamic = "force-dynamic";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function AccountPage() {
  const { user } = await withAuth();

  // Redirect to login if not authenticated
  if (!user) {
    redirect("/auth/login");
  }

  // Get initials from user name or email
  const getInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const displayName = user.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : "User";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <BlurFade delay={0}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
            <p className="text-muted-foreground">
              View your profile information
            </p>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <BlurFade delay={0.1}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-chart-5/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-chart-5" />
                </div>
                <div>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>
                    Your account information from WorkOS
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar and Name */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user.profilePictureUrl || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-medium">{displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>First Name</span>
                  </div>
                  <span className="text-sm font-medium">
                    {user.firstName || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Last Name</span>
                  </div>
                  <span className="text-sm font-medium">
                    {user.lastName || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{user.email}</span>
                    {user.emailVerified && (
                      <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </BlurFade>

        {/* Account Status */}
        <BlurFade delay={0.2}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-chart-3" />
                </div>
                <div>
                  <CardTitle>Account Status</CardTitle>
                  <CardDescription>
                    Security and account details
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Email Verified</span>
                  </div>
                  <Badge variant={user.emailVerified ? "default" : "secondary"}>
                    {user.emailVerified ? "Yes" : "No"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Account Created</span>
                  </div>
                  <span className="text-sm font-medium">
                    {formatDate(user.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Last Updated</span>
                  </div>
                  <span className="text-sm font-medium">
                    {formatDate(user.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>User ID</span>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {user.id.slice(0, 12)}...
                  </code>
                </div>
              </div>

              <Separator />

              {/* Sign Out */}
              <div className="pt-2">
                <Button variant="destructive" className="w-full" asChild>
                  <Link href="/auth/logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </BlurFade>
      </div>
    </div>
  );
}
