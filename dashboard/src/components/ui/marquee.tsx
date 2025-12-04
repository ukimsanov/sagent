"use client";

import { cn } from "@/lib/utils";
import { CSSProperties, ReactNode } from "react";

interface MarqueeProps {
	className?: string;
	reverse?: boolean;
	pauseOnHover?: boolean;
	children?: ReactNode;
	vertical?: boolean;
	repeat?: number;
	gap?: string;
	duration?: string;
}

export function Marquee({
	className,
	reverse = false,
	pauseOnHover = false,
	children,
	vertical = false,
	repeat = 4,
	gap = "1rem",
	duration = "40s",
}: MarqueeProps) {
	return (
		<div
			className={cn(
				"group flex overflow-hidden p-2 [--gap:1rem]",
				{
					"flex-row": !vertical,
					"flex-col": vertical,
				},
				className
			)}
			style={
				{
					"--gap": gap,
					"--duration": duration,
				} as CSSProperties
			}
		>
			{Array(repeat)
				.fill(0)
				.map((_, i) => (
					<div
						key={i}
						className={cn("flex shrink-0 justify-around [gap:var(--gap)]", {
							"animate-marquee flex-row": !vertical,
							"animate-marquee-vertical flex-col": vertical,
							"group-hover:[animation-play-state:paused]": pauseOnHover,
							"[animation-direction:reverse]": reverse,
						})}
					>
						{children}
					</div>
				))}
		</div>
	);
}
