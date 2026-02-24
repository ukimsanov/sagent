import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { UserMenu } from "@/components/user-menu";
import { getDB, getBusinessById } from "@/lib/db";
import { getUserBusinessId } from "@/lib/auth-utils";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "WhatsApp Agent Dashboard",
	description: "Analytics and management dashboard for WhatsApp AI Sales Agent",
};

// Force dynamic rendering to ensure consistent session handling
export const dynamic = "force-dynamic";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { user } = await withAuth();

	// Resolve business for authenticated users
	let businessName: string | null = null;
	let hasBusiness = false;

	if (user) {
		try {
			const db = await getDB();
			const businessId = await getUserBusinessId(db, user.id);
			if (businessId) {
				hasBusiness = true;
				const business = await getBusinessById(db, businessId);
				businessName = business?.name || null;
			}
		} catch {
			// DB might not be available during build — gracefully degrade
		}
	}

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<AuthKitProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						{user && hasBusiness ? (
							// Authenticated with business: Show dashboard with sidebar
							<SidebarProvider>
								<AppSidebar user={user} businessName={businessName} />
								<SidebarInset className="flex flex-col h-screen overflow-hidden">
									<header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
										<div className="flex items-center gap-2 h-9">
											<SidebarTrigger className="-ml-1" />
											<Separator orientation="vertical" className="mr-2 h-4" />
										</div>
										<div className="flex items-center gap-3 h-9">
											<ThemeToggle />
											<UserMenu user={user} />
										</div>
									</header>
									<main className="flex-1 overflow-auto p-6">
										{children}
									</main>
								</SidebarInset>
							</SidebarProvider>
						) : (
							// Not authenticated or no business: Full-width layout
							<main className="min-h-screen">
								{children}
							</main>
						)}
					</ThemeProvider>
				</AuthKitProvider>
			</body>
		</html>
	);
}
