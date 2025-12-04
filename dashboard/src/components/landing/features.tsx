"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import {
	Users,
	Zap,
	BarChart3,
	Brain,
	Clock,
	Shield,
	Sparkles,
	Inbox
} from "lucide-react";

const features = [
	{
		icon: Inbox,
		title: "Unified Inbox",
		description: "All your conversations from WhatsApp, Instagram, and Telegram in one place. Same AI, same quality, every channel.",
		className: "md:col-span-2 md:row-span-2",
		highlight: true,
		badges: ["Cross-channel context", "Unified history"],
	},
	{
		icon: Users,
		title: "Lead Scoring",
		description: "Automatically identify hot leads based on conversation patterns and buying intent across all channels.",
		className: "md:col-span-1",
	},
	{
		icon: Zap,
		title: "Instant Replies",
		description: "Sub-3 second response times, 24/7. Never miss a customer on any platform.",
		className: "md:col-span-1",
	},
	{
		icon: Brain,
		title: "Smart Recommendations",
		description: "AI suggests products based on customer preferences and conversation context.",
		className: "md:col-span-1",
	},
	{
		icon: BarChart3,
		title: "Analytics Dashboard",
		description: "Track conversations, conversion rates, and insights across all your channels.",
		className: "md:col-span-1",
	},
	{
		icon: Clock,
		title: "24/7 Availability",
		description: "Your AI agent works while you sleep, handling inquiries around the clock on every platform.",
		className: "md:col-span-1",
	},
	{
		icon: Shield,
		title: "Human Handoff",
		description: "Seamless escalation to your team when conversations need a personal touch.",
		className: "md:col-span-1",
	},
];

export function Features() {
	return (
		<section id="features" className="py-24 bg-muted/30">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-16">
					<BlurFade delay={0.1}>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
							<Sparkles className="h-3.5 w-3.5" />
							Features
						</div>
					</BlurFade>
					<BlurFade delay={0.2}>
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
							Everything you need to sell more
						</h2>
					</BlurFade>
					<BlurFade delay={0.3}>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							Powerful features that help you convert more customers without lifting a finger.
						</p>
					</BlurFade>
				</div>

				{/* Bento Grid */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{features.map((feature, index) => (
						<BlurFade key={feature.title} delay={0.1 + index * 0.05}>
							<MagicCard
								className={`p-6 h-full ${feature.className || ""} ${
									feature.highlight ? "bg-gradient-to-br from-card to-accent/30" : ""
								}`}
							>
								<div className={`flex flex-col h-full ${feature.highlight ? "justify-between" : ""}`}>
									<div>
										<div className={`inline-flex items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 ${
											feature.highlight ? "h-14 w-14" : "h-10 w-10"
										}`}>
											<feature.icon className={feature.highlight ? "h-7 w-7" : "h-5 w-5"} />
										</div>
										<h3 className={`font-semibold mb-2 ${feature.highlight ? "text-xl" : "text-base"}`}>
											{feature.title}
										</h3>
										<p className={`text-muted-foreground ${feature.highlight ? "text-base" : "text-sm"}`}>
											{feature.description}
										</p>
									</div>
									{feature.highlight && (
										<div className="mt-6 pt-4 border-t border-border/50">
											<div className="flex items-center gap-4 text-sm">
												<div className="flex items-center gap-1.5">
													<div className="h-2 w-2 rounded-full bg-chart-2" />
													<span className="text-muted-foreground">Cross-channel context</span>
												</div>
												<div className="flex items-center gap-1.5">
													<div className="h-2 w-2 rounded-full bg-chart-3" />
													<span className="text-muted-foreground">Unified history</span>
												</div>
											</div>
										</div>
									)}
								</div>
							</MagicCard>
						</BlurFade>
					))}
				</div>
			</div>
		</section>
	);
}
