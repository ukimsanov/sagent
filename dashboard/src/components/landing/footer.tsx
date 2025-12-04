"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

const footerLinks = {
	product: [
		{ name: "Channels", href: "#channels" },
		{ name: "Features", href: "#features" },
		{ name: "How it works", href: "#how-it-works" },
		{ name: "Pricing", href: "#pricing" },
	],
	company: [
		{ name: "About", href: "#" },
		{ name: "Blog", href: "#" },
		{ name: "Careers", href: "#" },
		{ name: "Contact", href: "#" },
	],
	legal: [
		{ name: "Privacy", href: "#" },
		{ name: "Terms", href: "#" },
		{ name: "Cookie Policy", href: "#" },
	],
};

export function Footer() {
	return (
		<footer className="border-t bg-muted/20">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="grid grid-cols-2 md:grid-cols-5 gap-8">
					{/* Brand */}
					<div className="col-span-2">
						<Link href="/" className="flex items-center gap-2 mb-4">
							<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
								<MessageCircle className="h-5 w-5" />
							</div>
							<span className="font-semibold">ChatAgent</span>
						</Link>
						<p className="text-sm text-muted-foreground max-w-xs">
							Your AI-powered sales agent for WhatsApp, Instagram, and Telegram.
							Handle thousands of conversations and convert more customers.
						</p>
					</div>

					{/* Product */}
					<div>
						<h4 className="font-medium mb-4">Product</h4>
						<ul className="space-y-2">
							{footerLinks.product.map((link) => (
								<li key={link.name}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground hover:text-foreground transition-colors"
									>
										{link.name}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Company */}
					<div>
						<h4 className="font-medium mb-4">Company</h4>
						<ul className="space-y-2">
							{footerLinks.company.map((link) => (
								<li key={link.name}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground hover:text-foreground transition-colors"
									>
										{link.name}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Legal */}
					<div>
						<h4 className="font-medium mb-4">Legal</h4>
						<ul className="space-y-2">
							{footerLinks.legal.map((link) => (
								<li key={link.name}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground hover:text-foreground transition-colors"
									>
										{link.name}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* Bottom */}
				<div className="border-t mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
					<p className="text-sm text-muted-foreground">
						&copy; {new Date().getFullYear()} ChatAgent. All rights reserved.
					</p>
					<div className="flex items-center gap-4">
						<Link
							href="#"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							Twitter
						</Link>
						<Link
							href="#"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							LinkedIn
						</Link>
						<Link
							href="#"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							GitHub
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
}
