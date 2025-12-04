"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";

const stats = [
	{
		value: 500,
		suffix: "+",
		label: "Businesses using",
		description: "Growing every day",
	},
	{
		value: 10,
		suffix: "M+",
		label: "Messages handled",
		description: "And counting",
	},
	{
		value: 24,
		suffix: "/7",
		label: "Availability",
		description: "Always on duty",
	},
	{
		value: 3,
		suffix: "s",
		label: "Avg response time",
		description: "Lightning fast",
	},
];

export function Stats() {
	return (
		<section className="py-24 bg-muted/30">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
					{stats.map((stat, index) => (
						<BlurFade key={stat.label} delay={0.1 + index * 0.1}>
							<div className="text-center">
								<div className="flex items-baseline justify-center gap-1">
									<NumberTicker
										value={stat.value}
										delay={0.3 + index * 0.1}
										className="text-4xl sm:text-5xl font-bold text-foreground"
									/>
									<span className="text-2xl sm:text-3xl font-bold text-primary">
										{stat.suffix}
									</span>
								</div>
								<p className="mt-2 font-medium text-foreground">{stat.label}</p>
								<p className="text-sm text-muted-foreground">{stat.description}</p>
							</div>
						</BlurFade>
					))}
				</div>
			</div>
		</section>
	);
}
