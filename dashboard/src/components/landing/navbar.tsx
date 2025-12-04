"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

interface NavbarProps {
	className?: string;
}

export function Navbar({ className }: NavbarProps) {
	const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
		e.preventDefault();
		const targetId = href.replace("#", "");
		const element = document.getElementById(targetId);
		if (element) {
			const navbarHeight = 64; // h-16 = 64px
			const elementPosition = element.getBoundingClientRect().top;
			const offsetPosition = elementPosition + window.scrollY - navbarHeight;

			window.scrollTo({
				top: offsetPosition,
				behavior: "smooth"
			});
		}
	};

	return (
		<motion.header
			initial={{ y: -20, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ duration: 0.5, ease: "easeOut" }}
			className={cn(
				"fixed top-0 left-0 right-0 z-50",
				"bg-background/80 backdrop-blur-md border-b border-border/50",
				className
			)}
		>
			<nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between h-16">
					{/* Logo */}
					<Link href="/" className="flex items-center gap-2 group">
						<motion.div
							className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm"
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
						>
							<MessageCircle className="h-5 w-5" />
						</motion.div>
						<span className="font-semibold text-foreground group-hover:text-primary transition-colors">
							ChatAgent
						</span>
					</Link>

					{/* Navigation Links */}
					<div className="hidden md:flex items-center gap-8">
						<NavLink href="#channels" onClick={scrollToSection}>Channels</NavLink>
						<NavLink href="#features" onClick={scrollToSection}>Features</NavLink>
						<NavLink href="#how-it-works" onClick={scrollToSection}>How it works</NavLink>
						<NavLink href="#pricing" onClick={scrollToSection}>Pricing</NavLink>
					</div>

					{/* CTA */}
					<div className="flex items-center gap-3">
						<Button variant="ghost" asChild className="hidden sm:inline-flex">
							<Link href="/auth/login">Sign in</Link>
						</Button>
						<Button asChild>
							<Link href="/auth/login">Get Started</Link>
						</Button>
					</div>
				</div>
			</nav>
		</motion.header>
	);
}

interface NavLinkProps {
	href: string;
	children: React.ReactNode;
	onClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

function NavLink({ href, children, onClick }: NavLinkProps) {
	return (
		<a
			href={href}
			onClick={(e) => onClick(e, href)}
			className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
		>
			{children}
		</a>
	);
}
