"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";

// Channel icons with status
const channels = [
	{ name: "WhatsApp", icon: WhatsappIcon, status: "live", color: "#25D366" },
	{ name: "Instagram", icon: InstagramIcon, status: "coming", color: "#E4405F" },
	{ name: "Telegram", icon: TelegramIcon, status: "coming", color: "#0088cc" },
];

function InstagramIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
		</svg>
	);
}

function TelegramIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
		</svg>
	);
}

export function Hero() {
	return (
		<section className="relative min-h-screen flex items-center justify-center pt-16 pb-20 overflow-hidden">
			{/* Background gradient */}
			<div className="absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-gradient-to-b from-background via-background to-accent/20" />
				<div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-chart-4/5 rounded-full blur-3xl" />
			</div>

			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="text-center space-y-8">
					{/* Badge */}
					<BlurFade delay={0.1}>
						<motion.div
							initial={{ scale: 0.95 }}
							animate={{ scale: 1 }}
							className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
						>
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
								<span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
							</span>
							Instagram & Telegram coming soon
						</motion.div>
					</BlurFade>

					{/* Headline */}
					<div className="space-y-4">
						<TextGenerateEffect
							words="One AI agent for all your messaging channels"
							className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight"
							duration={0.4}
						/>
						<BlurFade delay={0.5}>
							<p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
								Handle thousands of customer conversations across WhatsApp, Instagram, and Telegram.
								Your AI sales rep works 24/7 so you don&apos;t have to.
							</p>
						</BlurFade>
					</div>

					{/* Channel badges */}
					<BlurFade delay={0.6}>
						<div className="flex items-center justify-center gap-3 flex-wrap">
							{channels.map((channel) => (
								<motion.div
									key={channel.name}
									whileHover={{ scale: 1.05 }}
									className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${
										channel.status === "live"
											? "bg-card border-border"
											: "bg-muted/50 border-border/50"
									}`}
								>
									<channel.icon className="h-4 w-4" style={{ color: channel.color }} />
									<span className="text-sm font-medium">{channel.name}</span>
									{channel.status === "coming" && (
										<span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
											Soon
										</span>
									)}
								</motion.div>
							))}
						</div>
					</BlurFade>

					{/* CTAs */}
					<BlurFade delay={0.7}>
						<div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
							<Link href="/auth/login">
								<ShimmerButton
									className="shadow-lg"
									shimmerColor="rgba(255, 255, 255, 0.3)"
									background="oklch(0.55 0.15 195)"
								>
									<span className="flex items-center gap-2 text-white font-medium px-2">
										Start for free
										<ArrowRight className="h-4 w-4" />
									</span>
								</ShimmerButton>
							</Link>
							<Button variant="outline" size="lg" className="gap-2">
								<Play className="h-4 w-4" />
								Watch demo
							</Button>
						</div>
					</BlurFade>

					{/* Social proof */}
					<BlurFade delay={0.9}>
						<p className="text-sm text-muted-foreground pt-4">
							Trusted by 500+ businesses worldwide
						</p>
					</BlurFade>

					{/* Dashboard Preview */}
					<BlurFade delay={1.1}>
						<div className="relative mt-12 mx-auto max-w-4xl">
							<div className="relative rounded-xl border bg-card shadow-2xl overflow-hidden">
								<BorderBeam size={300} duration={15} />
								{/* Placeholder for dashboard screenshot */}
								<div className="aspect-[16/10] bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
									<div className="text-center space-y-2 p-8">
										<div className="w-16 h-16 mx-auto rounded-xl bg-primary/10 flex items-center justify-center">
											<svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
											</svg>
										</div>
										<p className="text-muted-foreground text-sm">
											Dashboard preview
										</p>
									</div>
								</div>
							</div>
							{/* Gradient shadow */}
							<div className="absolute -inset-px rounded-xl bg-gradient-to-t from-primary/20 via-transparent to-transparent -z-10 blur-xl" />
						</div>
					</BlurFade>
				</div>
			</div>
		</section>
	);
}
