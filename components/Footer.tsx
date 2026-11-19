import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Feather } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative z-10 overflow-hidden border-t border-white/[0.08] bg-[#05080f] text-slate-100">
      <span
        aria-hidden="true"
        className="aurora-horizon-line pointer-events-none absolute inset-x-0 top-0 z-20 h-[1px] opacity-75"
      />
      {/* Nairobi Skyline & Uhuru Park Backdrop */}
      <Image
        src="/images/photos/footer.webp"
        alt="Nairobi skyline overlooking Uhuru Park"
        fill
        loading="eager"
        sizes="100vw"
        className="object-cover object-[68%_46%] lg:object-[center_45%] brightness-[0.82] saturate-[0.9] contrast-[1.08]"
      />

      {/* Seamless Top Blend from #05080f into horizon */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#05080f] via-[#061018]/50 via-[44%] to-[#04070d]/95"
      />
      <div
        aria-hidden="true"
        className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#05080f]/82 via-[#06111c]/30 via-[48%] to-transparent"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
          {/* Brand Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e295d] to-[#2e3fa3] border border-sky-400/40 text-white flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.3)] shrink-0">
                <Feather className="w-5 h-5" />
              </span>
              <div>
                <span className="font-editorial text-xl font-semibold text-white block leading-none [text-shadow:0_2px_12px_rgba(0,0,0,0.75)]">
                  Tovolana Writers
                </span>
                <span className="text-[11px] font-tech tracking-wider text-teal-300 mt-1 block [text-shadow:0_1px_8px_rgba(0,0,0,0.75)]">
                  Trusted Kenyan Writing Marketplace
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed max-w-sm [text-shadow:0_2px_12px_rgba(0,0,0,0.85)]">
              Hire tested writers with clear prices upfront. Your payment is
              held safely until you approve the finished work.
            </p>
          </div>

          {/* Frosted Glass Navigation Ledger */}
          <div className="relative overflow-hidden lg:col-span-7 rounded-2xl bg-[#060d18]/78 backdrop-blur-xl border border-cyan-400/20 p-6 sm:p-7 shadow-[0_0_30px_-10px_rgba(45,212,191,0.22)]">
            <div
              aria-hidden="true"
              data-hud-theme="cyan"
              className="hud-border-beam-mask overflow-hidden opacity-45"
            >
              <div className="hud-border-beam-rotor hud-beam-square" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">
              <div>
                <h4 className="text-xs font-semibold text-white mb-3">
                  Find Help
                </h4>
                <ul className="space-y-2.5 text-sm text-slate-300">
                  <li>
                    <Link
                      href="/explore"
                      className="hover:text-teal-300 transition-colors"
                    >
                      All Services
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/explore?category=academic-writing"
                      className="hover:text-teal-300 transition-colors"
                    >
                      Academic
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/explore?category=research-papers"
                      className="hover:text-teal-300 transition-colors"
                    >
                      Research
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/explore?category=business-writing-and-proposals"
                      className="hover:text-teal-300 transition-colors"
                    >
                      Business
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-white mb-3">
                  Your Account
                </h4>
                <ul className="space-y-2.5 text-sm text-slate-300">
                  <li>
                    <Link
                      href="/dashboard"
                      className="hover:text-teal-300 transition-colors"
                    >
                      My Orders
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/creators-hub/join"
                      className="hover:text-teal-300 transition-colors"
                    >
                      Become a Writer
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/creators-hub"
                      className="hover:text-teal-300 transition-colors"
                    >
                      Writer Hub
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/membership"
                      className="hover:text-teal-300 transition-colors"
                    >
                      Free &amp; Pro Plans
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <h4 className="text-xs font-semibold text-white mb-3">
                  Safety &amp; Rules
                </h4>
                <ul className="grid grid-cols-2 sm:grid-cols-1 gap-x-4 gap-y-2.5 text-sm text-slate-300">
                  <li>
                    <Link
                      href="/policies"
                      className="hover:text-teal-300 transition-colors"
                    >
                      How Payments Work
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/policies#revisions"
                      className="hover:text-teal-300 transition-colors"
                    >
                      Free Edits
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/policies#integrity"
                      className="hover:text-teal-300 transition-colors"
                    >
                      Original Work
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/auth/verify"
                      className="hover:text-teal-300 transition-colors"
                    >
                      Verify Account
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.12] pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>Tovolana Writers</span>
          <span>Nairobi, Kenya · Safe, Simple Writing Help</span>
        </div>
      </div>
    </footer>
  );
}
