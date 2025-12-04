"use client";

import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
	{
		name: "Starter",
		description: "Perfect for small businesses getting started",
		price: 49,
		period: "month",
		features: [
			"Up to 1,000 messages/month",
			"1 WhatsApp number",
			"Basic product catalog",
			"Email support",
			"Standard response time",
		],
		cta: "Start free trial",
		popular: false,
	},
	{
		name: "Growth",
		description: "For businesses ready to scale",
		price: 149,
		period: "month",
		features: [
			"Up to 10,000 messages/month",
			"3 WhatsApp numbers",
			"Advanced AI training",
			"Priority support",
			"Analytics dashboard",
			"Human handoff",
			"Custom brand voice",
		],
		cta: "Start free trial",
		popular: true,
	},
	{
		name: "Enterprise",
		description: "Custom solutions for large teams",
		price: null,
		period: "month",
		features: [
			"Unlimited messages",
			"Unlimited numbers",
			"Dedicated account manager",
			"Custom integrations",
			"SLA guarantee",
			"Advanced security",
			"Multi-channel (coming soon)",
		],
		cta: "Contact sales",
		popular: false,
	},
];

export function Pricing() {
	return (
		<section id="pricing" className="py-24 bg-muted/30">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-16">
					<BlurFade delay={0.1}>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
							<Sparkles className="h-3.5 w-3.5" />
							Pricing
						</div>
					</BlurFade>
					<BlurFade delay={0.2}>
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
							Simple, transparent pricing
						</h2>
					</BlurFade>
					<BlurFade delay={0.3}>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							Start free, scale as you grow. No hidden fees, cancel anytime.
						</p>
					</BlurFade>
				</div>

				{/* Pricing cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
					{plans.map((plan, index) => (
						<BlurFade key={plan.name} delay={0.1 + index * 0.1}>
							<div
								className={cn(
									"relative h-full rounded-2xl border bg-card p-6 flex flex-col transition-all duration-300",
									plan.popular
										? "border-primary shadow-xl shadow-primary/20 scale-[1.02] md:scale-105"
										: "border-border/50 hover:border-border hover:shadow-lg"
								)}
							>
								{/* Popular badge */}
								{plan.popular && (
									<div className="absolute -top-3 left-1/2 -translate-x-1/2">
										<div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg">
											<Zap className="h-3 w-3" />
											Most Popular
										</div>
									</div>
								)}

								{/* Plan header */}
								<div className="mb-6">
									<h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
									<p className="text-sm text-muted-foreground">
										{plan.description}
									</p>
								</div>

								{/* Price */}
								<div className="mb-6">
									{plan.price !== null ? (
										<div className="flex items-baseline gap-1">
											<span className="text-4xl font-bold">${plan.price}</span>
											<span className="text-muted-foreground">/{plan.period}</span>
										</div>
									) : (
										<div className="text-4xl font-bold">Custom</div>
									)}
								</div>

								{/* Features */}
								<ul className="space-y-3 mb-8 flex-1">
									{plan.features.map((feature) => (
										<li key={feature} className="flex items-start gap-3 text-sm">
											<div className={cn(
												"h-5 w-5 rounded-full flex items-center justify-center shrink-0",
												plan.popular ? "bg-primary/20" : "bg-muted"
											)}>
												<Check className={cn(
													"h-3 w-3",
													plan.popular ? "text-primary" : "text-muted-foreground"
												)} />
											</div>
											<span className="text-muted-foreground">{feature}</span>
										</li>
									))}
								</ul>

								{/* CTA Button */}
								<Button
									className={cn(
										"w-full",
										plan.popular && "shadow-lg shadow-primary/25"
									)}
									variant={plan.popular ? "default" : "outline"}
									size="lg"
									asChild
								>
									<Link href={plan.price !== null ? "/auth/login" : "#contact"}>
										{plan.cta}
									</Link>
								</Button>
							</div>
						</BlurFade>
					))}
				</div>

				{/* FAQ teaser */}
				<BlurFade delay={0.5}>
					<div className="mt-12 text-center">
						<p className="text-muted-foreground">
							Have questions?{" "}
							<a href="#faq" className="text-primary hover:underline">
								Check our FAQ
							</a>{" "}
							or{" "}
							<a href="mailto:hello@chatagent.com" className="text-primary hover:underline">
								contact us
							</a>
						</p>
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
