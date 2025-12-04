"use client";

import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BorderBeam } from "@/components/ui/border-beam";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const benefits = [
	"No credit card required",
	"14-day free trial",
	"Cancel anytime",
];

export function CTASection() {
	return (
		<section className="py-16 sm:py-20 lg:py-24">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				<BlurFade delay={0.1}>
					<div className="relative rounded-3xl bg-gradient-to-br from-primary/5 via-card to-accent/10 border overflow-hidden">
						<BorderBeam size={400} duration={20} />
						<div className="relative px-8 py-16 sm:px-16 sm:py-20 text-center">
							{/* Content */}
							<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
								Ready to sell more on WhatsApp?
							</h2>
							<p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
								Join 500+ businesses using our AI agent to handle customer conversations
								and increase sales.
							</p>

							{/* CTA Button */}
							<div className="flex flex-col items-center gap-4">
								<Link href="/auth/login">
									<ShimmerButton
										className="shadow-xl"
										shimmerColor="rgba(255, 255, 255, 0.3)"
										background="oklch(0.55 0.15 195)"
									>
										<span className="flex items-center gap-2 text-white font-medium px-4 py-1">
											Start your free trial
											<ArrowRight className="h-4 w-4" />
										</span>
									</ShimmerButton>
								</Link>

								{/* Benefits */}
								<div className="flex flex-wrap justify-center gap-4 mt-4">
									{benefits.map((benefit) => (
										<div
											key={benefit}
											className="flex items-center gap-1.5 text-sm text-muted-foreground"
										>
											<CheckCircle2 className="h-4 w-4 text-chart-2" />
											{benefit}
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
