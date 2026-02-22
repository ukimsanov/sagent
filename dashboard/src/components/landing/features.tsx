"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { Card } from "@/components/ui/card";
import {
	Users,
	Zap,
	BarChart3,
	Brain,
	Clock,
	Shield,
	Inbox
} from "lucide-react";

const features = [
	{
		icon: Inbox,
		title: "Unified Inbox",
		description: "All conversations from WhatsApp, Instagram, and Telegram in one place.",
	},
	{
		icon: Users,
		title: "Lead Scoring",
		description: "Identify hot leads based on conversation patterns and buying intent.",
	},
	{
		icon: Zap,
		title: "Instant Replies",
		description: "Sub-3 second response times, 24/7. Never miss a customer.",
	},
	{
		icon: Brain,
		title: "Smart Recommendations",
		description: "AI suggests products based on preferences and context.",
	},
	{
		icon: BarChart3,
		title: "Analytics Dashboard",
		description: "Track conversations, conversion rates, and channel insights.",
	},
	{
		icon: Clock,
		title: "24/7 Availability",
		description: "Your AI agent works around the clock on every platform.",
	},
	{
		icon: Shield,
		title: "Human Handoff",
		description: "Seamless escalation when conversations need a personal touch.",
	},
];

export function Features() {
	return (
		<section id="features" className="py-20 sm:py-28 lg:py-32 bg-muted/30">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-16 sm:mb-20">
					<BlurFade delay={0.1}>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
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

				{/* Feature Grid - Clean 2-3-2 layout */}
				<div className="space-y-6">
					{/* First row - 2 cards centered */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
						{features.slice(0, 2).map((feature, index) => (
							<BlurFade key={feature.title} delay={0.1 + index * 0.05}>
								<Card className="p-6 h-full">
									<div className="flex flex-col items-center text-center">
										<div className="inline-flex items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 h-12 w-12">
											<feature.icon className="h-6 w-6" />
										</div>
										<h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
										<p className="text-muted-foreground text-sm">{feature.description}</p>
									</div>
								</Card>
							</BlurFade>
						))}
					</div>

					{/* Second row - 3 cards */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
						{features.slice(2, 5).map((feature, index) => (
							<BlurFade key={feature.title} delay={0.2 + index * 0.05}>
								<Card className="p-6 h-full">
									<div className="flex flex-col items-center text-center">
										<div className="inline-flex items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 h-12 w-12">
											<feature.icon className="h-6 w-6" />
										</div>
										<h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
										<p className="text-muted-foreground text-sm">{feature.description}</p>
									</div>
								</Card>
							</BlurFade>
						))}
					</div>

					{/* Third row - 2 cards centered */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
						{features.slice(5, 7).map((feature, index) => (
							<BlurFade key={feature.title} delay={0.3 + index * 0.05}>
								<Card className="p-6 h-full">
									<div className="flex flex-col items-center text-center">
										<div className="inline-flex items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 h-12 w-12">
											<feature.icon className="h-6 w-6" />
										</div>
										<h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
										<p className="text-muted-foreground text-sm">{feature.description}</p>
									</div>
								</Card>
							</BlurFade>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
