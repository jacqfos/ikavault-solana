import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/hero/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Features } from "@/components/sections/Features";
import { Architecture } from "@/components/sections/Architecture";
import { Security } from "@/components/sections/Security";
import { Roadmap } from "@/components/sections/Roadmap";
import { Dogfood } from "@/components/sections/Dogfood";
import { Footer } from "@/components/sections/Footer";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Nav />
      <Hero />
      <HowItWorks />
      <div id="features" />
      <Features />
      <Architecture />
      <Security />
      <Roadmap />
      <Dogfood />
      <Footer />
    </main>
  );
}
