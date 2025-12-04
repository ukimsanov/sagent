"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { motion } from "motion/react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { CheckCircle2, Clock } from "lucide-react";

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

const channels = [
	{
		name: "WhatsApp Business",
		icon: WhatsappIcon,
		color: "#25D366",
		bgColor: "bg-[#25D366]/10",
		status: "live",
		description: "Connect your WhatsApp Business account and start handling customer conversations instantly.",
		features: ["Business API integration", "Quick replies", "Product catalogs", "Message templates"],
	},
	{
		name: "Instagram DMs",
		icon: InstagramIcon,
		color: "#E4405F",
		bgColor: "bg-[#E4405F]/10",
		status: "coming",
		eta: "Q1 2025",
		description: "Respond to Instagram DMs automatically. Perfect for e-commerce and influencer brands.",
		features: ["Story replies", "DM automation", "Comment responses", "Shopping integration"],
	},
	{
		name: "Telegram",
		icon: TelegramIcon,
		color: "#0088cc",
		bgColor: "bg-[#0088cc]/10",
		status: "coming",
		eta: "Q2 2025",
		description: "Engage your Telegram community with AI-powered responses and automated workflows.",
		features: ["Bot integration", "Group management", "Channel broadcasts", "Inline queries"],
	},
];

export function Channels() {
	return (
		<section id="channels" className="py-16 sm:py-20 lg:py-24">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-16">
					<BlurFade delay={0.1}>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
							Integrations
						</div>
					</BlurFade>
					<BlurFade delay={0.2}>
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
							One dashboard, all your channels
						</h2>
					</BlurFade>
					<BlurFade delay={0.3}>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							Connect your messaging platforms and manage all customer conversations from a single place.
							Same AI, same quality, everywhere.
						</p>
					</BlurFade>
				</div>

				{/* Channel Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
					{channels.map((channel, index) => (
						<BlurFade key={channel.name} delay={0.2 + index * 0.1}>
							<MagicCard className="p-6 h-full">
								<div className="flex flex-col h-full">
									{/* Header */}
									<div className="flex items-start justify-between mb-4">
										<motion.div
											whileHover={{ scale: 1.1, rotate: 5 }}
											className={`h-14 w-14 rounded-xl ${channel.bgColor} flex items-center justify-center`}
										>
											<channel.icon className="h-7 w-7" style={{ color: channel.color }} />
										</motion.div>
										{channel.status === "live" ? (
											<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-chart-2/10 text-chart-2 text-xs font-medium">
												<CheckCircle2 className="h-3 w-3" />
												Live
											</span>
										) : (
											<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
												<Clock className="h-3 w-3" />
												{channel.eta}
											</span>
										)}
									</div>

									{/* Content */}
									<h3 className="text-xl font-semibold mb-2">{channel.name}</h3>
									<p className="text-muted-foreground text-sm mb-4 flex-grow">
										{channel.description}
									</p>

									{/* Features */}
									<div className="space-y-2 pt-4 border-t border-border/50">
										{channel.features.map((feature) => (
											<div key={feature} className="flex items-center gap-2 text-sm">
												<div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: channel.color }} />
												<span className="text-muted-foreground">{feature}</span>
											</div>
										))}
									</div>
								</div>
							</MagicCard>
						</BlurFade>
					))}
				</div>

				{/* Early Access CTA */}
				<BlurFade delay={0.6}>
					<div className="mt-12 text-center">
						<p className="text-muted-foreground mb-4">
							Want early access to Instagram or Telegram?
						</p>
						<motion.button
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
							className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium"
						>
							Join the waitlist
						</motion.button>
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
