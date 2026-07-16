import Link from "next/link";
import { ArrowRight, Search, BadgeCheck, ListChecks } from "lucide-react";
import { MarketplaceNav } from "@/components/layout/MarketplaceNav";
import { Button } from "@/components/ui/Button";

const HERO_IMG =
  "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1800&q=80";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MarketplaceNav />
      <section className="relative w-full min-h-[70vh] md:min-h-[870px] overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMG}
            alt="Skilled worker in Ghana"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 hero-gradient" />
          <div className="absolute inset-0 bg-background/40 md:bg-transparent" />
        </div>
        <div className="relative z-10 max-w-container mx-auto px-margin-mobile md:px-margin-desktop h-full min-h-[70vh] md:min-h-[870px] flex flex-col justify-center">
          <div className="max-w-2xl">
            <span className="font-label-caps text-primary tracking-widest block mb-sm">
              WorkPulse Connect
            </span>
            <h1 className="font-display text-[40px] md:text-[56px] leading-tight md:leading-[64px] text-primary mb-md font-extrabold tracking-tight">
              Find trusted skilled workers
              <br className="hidden md:block" /> in Ghana
            </h1>
            <p className="font-section-title text-on-surface-variant mb-xl leading-relaxed max-w-xl">
              Connecting Ghanaian households and businesses with verified,
              rated, and capable service professionals for every task.
            </p>
            <div className="flex flex-wrap gap-md">
              <Link href="/discover">
                <Button variant="conversion" className="rounded-xl">
                  Find a worker
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" className="rounded-xl">
                  Offer your skills
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-xl max-w-container mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="text-center mb-xl">
          <h2 className="font-page-title text-primary mb-sm">How it works</h2>
          <p className="text-on-surface-variant max-w-xl mx-auto">
            Getting your tasks completed by professionals in three simple steps.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          {[
            {
              icon: Search,
              title: "Search & Browse",
              body: "Tell us what you need and browse verified local experts near you.",
              tone: "bg-primary-container text-on-primary",
            },
            {
              icon: BadgeCheck,
              title: "Compare & Verify",
              body: "Review past work, ratings, and verification status before you hire.",
              tone: "bg-secondary-container text-on-secondary-container",
            },
            {
              icon: ListChecks,
              title: "Book & Pay",
              body: "Order securely, track progress, and pay through WorkPulse.",
              tone: "bg-primary-container text-on-primary",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="bg-surface-container-low p-lg rounded-card border border-outline-variant hover:shadow-lg transition"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-md ${step.tone}`}
              >
                <step.icon className="w-5 h-5" />
              </div>
              <h3 className="font-section-title text-primary mb-sm">
                {step.title}
              </h3>
              <p className="text-on-surface-variant">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-outline-variant py-lg text-center font-body-dense text-on-surface-variant">
        WorkPulse Connect · Pulse Field design system
      </footer>
    </div>
  );
}
