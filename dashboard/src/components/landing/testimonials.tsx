"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { Card } from "@/components/ui/card";
import { MessageSquare, Zap, Users, TrendingUp } from "lucide-react";

const valueProps = [
	{
		icon: Zap,
		title: "Instant responses",
		description: "Your customers get answers in seconds, not hours. Even at 2am on a Sunday.",
	},
	{
		icon: MessageSquare,
		title: "Natural conversations",
		description: "Not a chatbot that feels like a chatbot. Real product knowledge, real helpfulness.",
	},
	{
		icon: Users,
		title: "Seamless handoff",
		description: "When a conversation needs a human touch, the transition is smooth and context-rich.",
	},
	{
		icon: TrendingUp,
		title: "Built to convert",
		description: "Every conversation is a sales opportunity. The AI knows your catalog and recommends intelligently.",
	},
];

export function Testimonials() {
	return (
		<section id="testimonials" className="py-20 sm:py-28 lg:py-32 bg-background">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-16">
					<BlurFade delay={0.1}>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
							Why us
						</div>
					</BlurFade>
					<BlurFade delay={0.2}>
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
							Built for growing businesses
						</h2>
					</BlurFade>
					<BlurFade delay={0.3}>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							An AI sales agent that actually understands your products and your customers.
						</p>
					</BlurFade>
				</div>

				{/* Value props grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
					{valueProps.map((prop, index) => (
						<BlurFade key={prop.title} delay={0.1 + index * 0.1}>
							<Card className="p-6 h-full">
								<div className="flex gap-4">
									<div className="inline-flex items-center justify-center rounded-xl bg-primary/10 text-primary h-12 w-12 shrink-0">
										<prop.icon className="h-6 w-6" />
									</div>
									<div>
										<h3 className="font-semibold text-lg mb-1">{prop.title}</h3>
										<p className="text-muted-foreground text-sm">{prop.description}</p>
									</div>
								</div>
							</Card>
						</BlurFade>
					))}
				</div>
			</div>
		</section>
	);
}
