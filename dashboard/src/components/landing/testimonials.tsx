"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { Star, Quote } from "lucide-react";

const testimonials = [
	{
		name: "Sarah Chen",
		role: "Founder",
		company: "Urban Threads",
		image: "SC",
		content: "We went from missing 60% of late-night inquiries to converting them into sales. The AI handles sizing questions better than my team.",
		metric: "3x more conversions",
		stars: 5,
	},
	{
		name: "Marcus Rodriguez",
		role: "E-commerce Director",
		company: "Kicks & Co",
		image: "MR",
		content: "Our response time dropped from 4 hours to under 3 seconds. Customers are shocked when they get instant, helpful replies at 2am.",
		metric: "2.3s avg response",
		stars: 5,
	},
	{
		name: "Emma Thompson",
		role: "CEO",
		company: "Luxe Beauty",
		image: "ET",
		content: "The human handoff feature is seamless. When customers need that personal touch, the transition feels natural.",
		metric: "92% satisfaction",
		stars: 5,
	},
	{
		name: "David Kim",
		role: "Operations Lead",
		company: "TechGear Shop",
		image: "DK",
		content: "Setup took 20 minutes. Within a week, the AI was handling 80% of our WhatsApp inquiries without any intervention.",
		metric: "80% automation",
		stars: 5,
	},
];

const stats = [
	{ value: "500+", label: "Active Businesses" },
	{ value: "2M+", label: "Messages Handled" },
	{ value: "35%", label: "Avg. Sales Increase" },
	{ value: "2.3s", label: "Avg. Response Time" },
];

export function Testimonials() {
	return (
		<section id="testimonials" className="py-20 sm:py-28 lg:py-32 bg-background">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-16">
					<BlurFade delay={0.1}>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-chart-4/10 text-chart-4 text-sm font-medium mb-4">
							<Quote className="h-3.5 w-3.5" />
							Testimonials
						</div>
					</BlurFade>
					<BlurFade delay={0.2}>
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
							Loved by businesses worldwide
						</h2>
					</BlurFade>
					<BlurFade delay={0.3}>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							See how companies are transforming their customer conversations into revenue.
						</p>
					</BlurFade>
				</div>

				{/* Stats bar */}
				<BlurFade delay={0.35}>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
						{stats.map((stat, index) => (
							<div
								key={stat.label}
								className="text-center p-6 rounded-xl bg-muted/30 border border-border/50"
							>
								<div className="text-3xl sm:text-4xl font-bold text-primary mb-1">
									{stat.value}
								</div>
								<div className="text-sm text-muted-foreground">
									{stat.label}
								</div>
							</div>
						))}
					</div>
				</BlurFade>

				{/* Testimonials grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
					{testimonials.map((testimonial, index) => (
						<BlurFade key={testimonial.name} delay={0.1 + index * 0.1}>
							<MagicCard className="p-6 h-full">
								<div className="flex flex-col h-full">
									{/* Stars */}
									<div className="flex gap-0.5 mb-4">
										{Array.from({ length: testimonial.stars }).map((_, i) => (
											<Star
												key={i}
												className="h-4 w-4 fill-yellow-400 text-yellow-400"
											/>
										))}
									</div>

									{/* Content */}
									<blockquote className="text-foreground mb-6 flex-1">
										&ldquo;{testimonial.content}&rdquo;
									</blockquote>

									{/* Metric badge */}
									<div className="mb-4">
										<span className="inline-flex items-center px-3 py-1 rounded-full bg-chart-2/10 text-chart-2 text-sm font-medium">
											{testimonial.metric}
										</span>
									</div>

									{/* Author */}
									<div className="flex items-center gap-3 pt-4 border-t border-border/50">
										<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
											{testimonial.image}
										</div>
										<div>
											<div className="font-medium text-sm">
												{testimonial.name}
											</div>
											<div className="text-xs text-muted-foreground">
												{testimonial.role} at {testimonial.company}
											</div>
										</div>
									</div>
								</div>
							</MagicCard>
						</BlurFade>
					))}
				</div>

				{/* G2/Capterra badges placeholder */}
				<BlurFade delay={0.6}>
					<div className="mt-12 text-center">
						<p className="text-sm text-muted-foreground mb-4">
							Rated highly on
						</p>
						<div className="flex items-center justify-center gap-8">
							<div className="flex items-center gap-2">
								<div className="h-8 w-8 rounded bg-orange-500/20 flex items-center justify-center text-orange-500 font-bold text-sm">
									G2
								</div>
								<div className="text-left">
									<div className="text-sm font-medium">4.8/5</div>
									<div className="text-xs text-muted-foreground">on G2</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-8 w-8 rounded bg-green-500/20 flex items-center justify-center text-green-500 font-bold text-sm">
									C
								</div>
								<div className="text-left">
									<div className="text-sm font-medium">4.9/5</div>
									<div className="text-xs text-muted-foreground">on Capterra</div>
								</div>
							</div>
						</div>
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
