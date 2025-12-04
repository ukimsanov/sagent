"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Star, Play } from "lucide-react";
import { useState, useEffect } from "react";

// Animated chat conversation
const chatMessages = [
	{ role: "user", text: "Hey, do you have any black hoodies?", delay: 0 },
	{
		role: "agent",
		text: "Hi! Yes, we have several black hoodies in stock. Here are our top picks:",
		delay: 1500,
	},
	{
		role: "agent",
		text: "• Oversized Essential - $89\n• Premium Cotton - $75\n• Limited Edition - $120",
		delay: 3000,
		isProduct: true,
	},
	{ role: "user", text: "Nice! What sizes for the Essential?", delay: 5000 },
	{
		role: "agent",
		text: "The Oversized Essential comes in S, M, L, XL. Most customers prefer sizing down for a regular fit.",
		delay: 6500,
	},
];

function ChatBubble({
	message,
	isVisible,
}: {
	message: (typeof chatMessages)[0];
	isVisible: boolean;
}) {
	const isUser = message.role === "user";

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ opacity: 0, y: 10, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, scale: 0.95 }}
					transition={{ duration: 0.3, ease: "easeOut" }}
					className={`flex ${isUser ? "justify-end" : "justify-start"}`}
				>
					<div
						className={`max-w-[85%] px-4 py-2.5 shadow-sm ${
							isUser
								? "bg-[#dcf8c6] text-gray-900 rounded-2xl rounded-br-md"
								: "bg-white text-gray-900 rounded-2xl rounded-bl-md"
						} ${message.isProduct ? "font-mono text-[13px]" : "text-sm"}`}
					>
						<p className="whitespace-pre-line leading-relaxed">{message.text}</p>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

function AnimatedChat() {
	const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
	const [isTyping, setIsTyping] = useState(false);

	useEffect(() => {
		chatMessages.forEach((msg, index) => {
			if (msg.role === "agent" && msg.delay > 0) {
				setTimeout(() => setIsTyping(true), msg.delay - 800);
			}

			setTimeout(() => {
				setIsTyping(false);
				setVisibleMessages((prev) => [...prev, index]);
			}, msg.delay);
		});

		const totalDuration = 10000;
		const interval = setInterval(() => {
			setVisibleMessages([]);
			chatMessages.forEach((msg, index) => {
				if (msg.role === "agent" && msg.delay > 0) {
					setTimeout(() => setIsTyping(true), msg.delay - 800);
				}
				setTimeout(() => {
					setIsTyping(false);
					setVisibleMessages((prev) => [...prev, index]);
				}, msg.delay);
			});
		}, totalDuration);

		return () => clearInterval(interval);
	}, []);

	return (
		<div className="w-full max-w-[340px] mx-auto">
			{/* Phone frame */}
			<div className="bg-gray-900 rounded-[2.5rem] p-2 shadow-2xl">
				<div className="bg-white rounded-[2rem] overflow-hidden">
					{/* WhatsApp header */}
					<div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-lg">
							🛍️
						</div>
						<div className="flex-1 min-w-0">
							<p className="font-medium text-sm truncate">Urban Street Store</p>
							<div className="flex items-center gap-1.5 text-xs text-white/80">
								<span className="h-2 w-2 rounded-full bg-green-400 animate-pulse flex-shrink-0"></span>
								<span className="truncate">AI Agent • Online</span>
							</div>
						</div>
					</div>

					{/* Chat area */}
					<div
						className="p-4 space-y-2.5 min-h-[280px] max-h-[280px] overflow-hidden"
						style={{
							backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
							backgroundColor: "#ECE5DD",
						}}
					>
						{chatMessages.map((message, index) => (
							<ChatBubble
								key={index}
								message={message}
								isVisible={visibleMessages.includes(index)}
							/>
						))}

						{/* Typing indicator */}
						<AnimatePresence>
							{isTyping && (
								<motion.div
									initial={{ opacity: 0, y: 5 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
									className="flex justify-start"
								>
									<div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
										<div className="flex gap-1">
											<motion.div
												animate={{ y: [0, -4, 0] }}
												transition={{
													repeat: Infinity,
													duration: 0.6,
													delay: 0,
												}}
												className="h-2 w-2 rounded-full bg-gray-400"
											/>
											<motion.div
												animate={{ y: [0, -4, 0] }}
												transition={{
													repeat: Infinity,
													duration: 0.6,
													delay: 0.15,
												}}
												className="h-2 w-2 rounded-full bg-gray-400"
											/>
											<motion.div
												animate={{ y: [0, -4, 0] }}
												transition={{
													repeat: Infinity,
													duration: 0.6,
													delay: 0.3,
												}}
												className="h-2 w-2 rounded-full bg-gray-400"
											/>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					{/* Input area */}
					<div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2">
						<div className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-500">
							Type a message...
						</div>
						<div className="h-10 w-10 rounded-full bg-[#075E54] flex items-center justify-center flex-shrink-0">
							<svg
								className="h-5 w-5 text-white"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
							</svg>
						</div>
					</div>
				</div>
			</div>

			{/* Response time badge */}
			<div className="mt-4 flex justify-center">
				<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border text-sm">
					<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
					<span className="text-muted-foreground">
						Avg. response time:{" "}
						<span className="font-medium text-foreground">2.3s</span>
					</span>
				</div>
			</div>
		</div>
	);
}

export function Hero() {
	return (
		<section className="relative pt-32 pb-24 overflow-hidden">
			{/* Background */}
			<div className="absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
				<div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
				<div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
			</div>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
					{/* Left column - Content */}
					<div className="text-center lg:text-left">
						{/* Badge */}
						<BlurFade delay={0.1}>
							<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
								<span className="relative flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
									<span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
								</span>
								Now with 35% faster responses
							</div>
						</BlurFade>

						{/* Headline */}
						<BlurFade delay={0.2}>
							<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
								Turn conversations into{" "}
								<span className="text-primary">conversions</span>
							</h1>
						</BlurFade>

						<BlurFade delay={0.3}>
							<p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-xl mx-auto lg:mx-0">
								Your AI sales agent handles customer inquiries 24/7 on
								WhatsApp. Answer questions, recommend products, and close sales
								while you sleep.
							</p>
						</BlurFade>

						{/* Social proof */}
						<BlurFade delay={0.4}>
							<div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 mb-10">
								<div className="flex items-center gap-2">
									<div className="flex -space-x-2">
										{["👤", "👩", "👨", "👩‍💼"].map((emoji, i) => (
											<div
												key={i}
												className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-sm"
											>
												{emoji}
											</div>
										))}
									</div>
									<span className="text-sm text-muted-foreground">
										500+ businesses
									</span>
								</div>
								<div className="flex items-center gap-1">
									{[1, 2, 3, 4, 5].map((i) => (
										<Star
											key={i}
											className="h-4 w-4 fill-yellow-400 text-yellow-400"
										/>
									))}
									<span className="text-sm text-muted-foreground ml-1">
										4.9/5 rating
									</span>
								</div>
							</div>
						</BlurFade>

						{/* CTAs */}
						<BlurFade delay={0.5}>
							<div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-6">
								<Button size="lg" className="gap-2" asChild>
									<Link href="/auth/login">
										Start free trial
										<ArrowRight className="h-4 w-4" />
									</Link>
								</Button>
								<Button
									variant="outline"
									size="lg"
									className="gap-2"
									asChild
								>
									<Link href="#how-it-works">
										<Play className="h-4 w-4" />
										See how it works
									</Link>
								</Button>
							</div>
							<p className="text-sm text-muted-foreground flex items-center justify-center lg:justify-start gap-2">
								<Check className="h-4 w-4 text-green-500" />
								No credit card required • 14-day free trial
							</p>
						</BlurFade>
					</div>

					{/* Right column - Chat Demo */}
					<BlurFade delay={0.3} direction="left">
						<AnimatedChat />
					</BlurFade>
				</div>

				{/* Trusted by */}
				<BlurFade delay={0.6}>
					<div className="mt-24 pt-12 border-t border-border/50">
						<p className="text-center text-sm text-muted-foreground mb-8">
							Trusted by innovative companies
						</p>
						<div className="flex items-center justify-center gap-12 opacity-50 grayscale">
							{["TechCrunch", "Forbes", "Wired", "Inc."].map((name) => (
								<div
									key={name}
									className="text-xl font-bold text-muted-foreground"
								>
									{name}
								</div>
							))}
						</div>
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
