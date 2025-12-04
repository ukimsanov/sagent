import { Navbar } from "./navbar";
import { Hero } from "./hero";
import { Channels } from "./channels";
import { Features } from "./features";
import { HowItWorks } from "./how-it-works";
import { Stats } from "./stats";
import { Testimonials } from "./testimonials";
import { Pricing } from "./pricing";
import { FAQ } from "./faq";
import { CTASection } from "./cta-section";
import { Footer } from "./footer";

export function LandingPage() {
	return (
		<div className="min-h-screen">
			<Navbar />
			<main>
				<Hero />
				<Channels />
				<Features />
				<HowItWorks />
				<Stats />
				<Testimonials />
				<Pricing />
				<FAQ />
				<CTASection />
			</main>
			<Footer />
		</div>
	);
}
