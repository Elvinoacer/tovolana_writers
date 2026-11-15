import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Feather } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#07110f] text-[#faf7f2]">
      {/* Strategic Nairobi Skyline & Uhuru Park Backdrop */}
      <Image
        src="/images/photos/footer.webp"
        alt="Nairobi skyline overlooking Uhuru Park"
        fill
        loading="eager"
        sizes="100vw"
        className="object-cover object-[68%_46%] lg:object-[center_45%] brightness-[0.95] saturate-[0.94] contrast-[1.06]"
      />

      {/* Seamless Top Blend from #0c1b18 + Clear Horizon Window + Grounded Base */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#0c1b18] via-[#091815]/42 via-[44%] to-[#050c0b]/92"
      />
      <div
        aria-hidden="true"
        className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#071311]/78 via-[#071311]/25 via-[48%] to-transparent"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
          {/* Brand Editorial Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#faf7f2] text-[#0c1b18] flex items-center justify-center shadow-md shrink-0">
                <Feather className="w-5 h-5" />
              </span>
              <div>
                <span className="font-editorial text-xl font-semibold text-white block leading-none [text-shadow:0_2px_12px_rgba(0,0,0,0.75)]">
                  Tovolana Writers
                </span>
                <span className="text-[11px] font-tech tracking-wider text-emerald-200 mt-1 block [text-shadow:0_1px_8px_rgba(0,0,0,0.75)]">
                  Vetted Editorial Marketplace
                </span>
              </div>
            </div>

            <p className="text-sm text-stone-100 leading-relaxed max-w-sm [text-shadow:0_2px_12px_rgba(0,0,0,0.85)]">
              Commission vetted researchers, strategists, and editors with
              locked KES totals, private file vaults, and IntaSend escrow
              protection.
            </p>
          </div>

          {/* Frosted Glass Navigation Ledger — Keeps Skyline Visible While Guaranteeing Link Contrast */}
          <div className="lg:col-span-7 rounded-2xl bg-[#06100e]/64 backdrop-blur-md border border-white/18 p-6 sm:p-7 shadow-2xl">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">
              <div>
                <h4 className="text-xs font-semibold text-white mb-3">
                  Discover
                </h4>
                <ul className="space-y-2.5 text-sm text-stone-200">
                  <li>
                    <Link
                      href="/explore"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      All Services
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/explore?category=academic-writing"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Academic
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/explore?category=research-papers"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Research
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/explore?category=business-writing-and-proposals"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Business
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-white mb-3">
                  Workspaces
                </h4>
                <ul className="space-y-2.5 text-sm text-stone-200">
                  <li>
                    <Link
                      href="/dashboard"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Customer Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/creators-hub/join"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Become a Creator
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/creators-hub"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Creators Hub
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/membership"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Free &amp; Pro Tiers
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <h4 className="text-xs font-semibold text-white mb-3">Trust</h4>
                <ul className="grid grid-cols-2 sm:grid-cols-1 gap-x-4 gap-y-2.5 text-sm text-stone-200">
                  <li>
                    <Link
                      href="/policies"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Escrow Rules
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/policies#revisions"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Revisions
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/policies#integrity"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Integrity Charter
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/auth/verify"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      Verification
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/15 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-300">
          <span>Tovolana Writers</span>
          <span>Nairobi, Kenya · Escrow-Protected Writing Services</span>
        </div>
      </div>
    </footer>
  );
}
