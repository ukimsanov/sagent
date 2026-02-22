"use client";

import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const benefits = [
	"No credit card required",
	"14-day free trial",
	"Cancel anytime",
];

export function CTASection() {
	return (
		<section className="py-20 sm:py-28 lg:py-32">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				<BlurFade delay={0.1}>
					<div className="relative rounded-3xl bg-muted/50 border overflow-hidden">
						<div className="relative px-8 py-16 sm:px-16 sm:py-20 text-center">
							<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
								Ready to sell more on WhatsApp?
							</h2>
							<p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
								Start your free trial and see how an AI sales agent can handle
								customer conversations and increase sales.
							</p>

							{/* CTA Button */}
							<div className="flex flex-col items-center gap-4">
								<Button size="lg" className="gap-2" asChild>
									<Link href="/auth/login">
										Start your free trial
										<ArrowRight className="h-4 w-4" />
									</Link>
								</Button>

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
