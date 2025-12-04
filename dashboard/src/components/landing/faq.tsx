"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { HelpCircle } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
	{
		question: "How does the AI agent work with WhatsApp?",
		answer:
			"Our AI agent integrates directly with the official WhatsApp Business API. When customers message your business number, our AI instantly analyzes their intent, searches your product catalog, and responds with personalized recommendations—all within seconds.",
	},
	{
		question: "Can the AI understand different languages?",
		answer:
			"Yes! Our AI supports 50+ languages out of the box. It automatically detects the customer's language and responds naturally. You can also set a preferred language for your business if needed.",
	},
	{
		question: "What happens if the AI can't answer a question?",
		answer:
			"When the AI encounters complex questions or sensitive topics, it seamlessly hands off to your human team. The handoff includes full conversation context, so your team can pick up right where the AI left off—no customer repeating themselves.",
	},
	{
		question: "How do I train the AI on my products?",
		answer:
			"Simply connect your product catalog via CSV, API, or popular e-commerce platforms like Shopify. The AI automatically learns your product names, descriptions, prices, and categories. No manual training required—it just works.",
	},
	{
		question: "Is my customer data secure?",
		answer:
			"Absolutely. We're SOC 2 Type II compliant and GDPR ready. All data is encrypted at rest and in transit. We never share your customer data with third parties, and you can request complete data deletion at any time.",
	},
	{
		question: "Can I customize the AI's personality and responses?",
		answer:
			"Yes! You control the AI's tone (casual, professional, friendly), greeting messages, and escalation rules. You can also set custom responses for specific questions and define your brand voice guidelines.",
	},
	{
		question: "How long does setup take?",
		answer:
			"Most businesses are up and running within 30 minutes. Connect your WhatsApp Business account, upload your catalog, and customize your settings. Our onboarding wizard guides you through each step.",
	},
	{
		question: "What's included in the free trial?",
		answer:
			"Your 14-day free trial includes all Growth plan features—up to 1,000 messages, full analytics, and priority support. No credit card required. You can upgrade, downgrade, or cancel anytime.",
	},
];

export function FAQ() {
	return (
		<section id="faq" className="py-20 sm:py-28 lg:py-32 bg-muted/30">
			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-12">
					<BlurFade delay={0.1}>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
							<HelpCircle className="h-3.5 w-3.5" />
							FAQ
						</div>
					</BlurFade>
					<BlurFade delay={0.2}>
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
							Frequently asked questions
						</h2>
					</BlurFade>
					<BlurFade delay={0.3}>
						<p className="text-lg text-muted-foreground">
							Everything you need to know about ChatAgent. Can&apos;t find the
							answer you&apos;re looking for?{" "}
							<a
								href="mailto:hello@chatagent.com"
								className="text-primary hover:underline"
							>
								Reach out to our team
							</a>
							.
						</p>
					</BlurFade>
				</div>

				{/* FAQ Accordion */}
				<BlurFade delay={0.4}>
					<div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
						<Accordion type="single" collapsible defaultValue="item-0" className="w-full">
							{faqs.map((faq, index) => (
								<AccordionItem
									key={index}
									value={`item-${index}`}
									className="px-6 border-border/50"
								>
									<AccordionTrigger className="text-left text-base font-medium hover:no-underline py-5">
										{faq.question}
									</AccordionTrigger>
									<AccordionContent className="text-muted-foreground leading-relaxed pb-5">
										{faq.answer}
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</BlurFade>

				{/* Support CTA */}
				<BlurFade delay={0.5}>
					<div className="mt-10 text-center">
						<p className="text-sm text-muted-foreground">
							Still have questions?{" "}
							<a
								href="mailto:hello@chatagent.com"
								className="text-primary font-medium hover:underline"
							>
								Contact our support team
							</a>
						</p>
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
