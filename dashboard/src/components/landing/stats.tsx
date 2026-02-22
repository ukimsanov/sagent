"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { Clock, MessageSquare, Bot, Headphones } from "lucide-react";

const highlights = [
	{
		icon: Clock,
		title: "Always available",
		description: "Your AI agent works 24/7, handling inquiries even when your team is offline.",
	},
	{
		icon: MessageSquare,
		title: "Sub-3s responses",
		description: "Customers get instant, helpful answers — no waiting, no frustration.",
	},
	{
		icon: Bot,
		title: "Context-aware",
		description: "Remembers preferences, past interactions, and product details across conversations.",
	},
	{
		icon: Headphones,
		title: "Human when needed",
		description: "Automatic escalation to your team when a conversation needs the personal touch.",
	},
];

export function Stats() {
	return (
		<section className="py-20 sm:py-28 lg:py-32 bg-muted/30">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
					{highlights.map((item, index) => (
						<BlurFade key={item.title} delay={0.1 + index * 0.1}>
							<div className="text-center">
								<div className="inline-flex items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 h-12 w-12 mx-auto">
									<item.icon className="h-6 w-6" />
								</div>
								<h3 className="font-semibold mb-1">{item.title}</h3>
								<p className="text-sm text-muted-foreground">{item.description}</p>
							</div>
						</BlurFade>
					))}
				</div>
			</div>
		</section>
	);
}
