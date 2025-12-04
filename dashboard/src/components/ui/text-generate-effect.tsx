"use client";

import { useEffect } from "react";
import { motion, stagger, useAnimate } from "motion/react";
import { cn } from "@/lib/utils";

export interface TextGenerateEffectProps {
	words: string;
	className?: string;
	filter?: boolean;
	duration?: number;
}

export function TextGenerateEffect({
	words,
	className,
	filter = true,
	duration = 0.5,
}: TextGenerateEffectProps) {
	const [scope, animate] = useAnimate();
	const wordsArray = words.split(" ");

	useEffect(() => {
		animate(
			"span",
			{
				opacity: 1,
				filter: filter ? "blur(0px)" : "none",
			},
			{
				duration: duration,
				delay: stagger(0.1),
			}
		);
	}, [animate, duration, filter]);

	const renderWords = () => {
		return (
			<motion.div ref={scope}>
				{wordsArray.map((word, idx) => (
					<motion.span
						key={word + idx}
						className="opacity-0"
						style={{
							filter: filter ? "blur(10px)" : "none",
						}}
					>
						{word}{" "}
					</motion.span>
				))}
			</motion.div>
		);
	};

	return (
		<div className={cn("font-bold", className)}>
			{renderWords()}
		</div>
	);
}
