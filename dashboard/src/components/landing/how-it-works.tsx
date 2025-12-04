"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { motion } from "motion/react";
import { Settings, MessageCircle, TrendingUp } from "lucide-react";

const steps = [
	{
		number: "01",
		icon: Settings,
		title: "Connect your store",
		description: "Link your product catalog and set your brand voice. Takes about 10 minutes.",
	},
	{
		number: "02",
		icon: MessageCircle,
		title: "AI handles conversations",
		description: "Your agent responds to customers, answers questions, and recommends products.",
	},
	{
		number: "03",
		icon: TrendingUp,
		title: "Watch sales grow",
		description: "Track performance, optimize responses, and scale your WhatsApp sales.",
	},
];

export function HowItWorks() {
	return (
		<section id="how-it-works" className="py-24">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-16">
					<BlurFade delay={0.1}>
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
							Up and running in minutes
						</h2>
					</BlurFade>
					<BlurFade delay={0.2}>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							No complex setup. No coding required. Just connect and start selling.
						</p>
					</BlurFade>
				</div>

				{/* Steps */}
				<div className="relative">
					{/* Connection line - desktop */}
					<div className="hidden md:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-border via-primary/30 to-border" />

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
						{steps.map((step, index) => (
							<BlurFade key={step.number} delay={0.2 + index * 0.15}>
								<motion.div
									className="relative text-center"
									whileHover={{ y: -4 }}
									transition={{ type: "spring", stiffness: 300, damping: 20 }}
								>
									{/* Step number badge */}
									<div className="relative inline-flex items-center justify-center mb-6">
										<div className="absolute inset-0 rounded-full bg-primary/10 scale-150" />
										<div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-card border-2 border-primary/20 shadow-lg">
											<step.icon className="h-8 w-8 text-primary" />
										</div>
										<div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-lg">
											{step.number}
										</div>
									</div>

									{/* Content */}
									<h3 className="text-xl font-semibold mb-2">{step.title}</h3>
									<p className="text-muted-foreground">{step.description}</p>
								</motion.div>
							</BlurFade>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
