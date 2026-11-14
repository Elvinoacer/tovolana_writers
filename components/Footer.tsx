import React from "react";
import Link from "next/link";
import { CalendarClock, Feather, Lock, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[#e6e0d4] bg-[#f2ede3]/70 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-xs">
              <Feather className="w-4.5 h-4.5" />
            </span>
            <div>
              <span className="font-editorial text-lg font-semibold block leading-none">
                Tovolana Writers
              </span>
              <span className="text-[10px] font-tech uppercase tracking-widest text-stone-500">
                Vetted Editorial Marketplace
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
              Free Booking Access
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1e3a8a] bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
              <Lock className="w-3.5 h-3.5" />
              IntaSend Escrow
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-800 bg-white border border-[#e6e0d4] px-3 py-1 rounded-full">
              <CalendarClock className="w-3.5 h-3.5 text-amber-700" />
              Deadline Lock
            </span>
          </div>
        </div>

        <div className="md:col-span-2">
          <h4 className="font-tech uppercase tracking-wider text-[11px] font-semibold text-stone-500 mb-3">
            Discover
          </h4>
          <ul className="space-y-2 text-sm text-stone-700">
            <li>
              <Link href="/explore" className="hover:text-[#1e3a8a]">
                All Services
              </Link>
            </li>
            <li>
              <Link
                href="/explore?category=academic-writing"
                className="hover:text-[#1e3a8a]"
              >
                Academic
              </Link>
            </li>
            <li>
              <Link
                href="/explore?category=research-papers"
                className="hover:text-[#1e3a8a]"
              >
                Research
              </Link>
            </li>
            <li>
              <Link
                href="/explore?category=business-writing-and-proposals"
                className="hover:text-[#1e3a8a]"
              >
                Business
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h4 className="font-tech uppercase tracking-wider text-[11px] font-semibold text-stone-500 mb-3">
            Workspaces
          </h4>
          <ul className="space-y-2 text-sm text-stone-700">
            <li>
              <Link href="/dashboard" className="hover:text-[#1e3a8a]">
                Customer Dashboard
              </Link>
            </li>
            <li>
              <Link href="/creators-hub/join" className="hover:text-[#1e3a8a]">
                Become a Creator
              </Link>
            </li>
            <li>
              <Link href="/creators-hub" className="hover:text-[#1e3a8a]">
                Creators Hub
              </Link>
            </li>
            <li>
              <Link href="/membership" className="hover:text-[#1e3a8a]">
                Free &amp; Pro Tiers
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <h4 className="font-tech uppercase tracking-wider text-[11px] font-semibold text-stone-500 mb-3">
            Trust
          </h4>
          <ul className="space-y-2 text-sm text-stone-700">
            <li>
              <Link href="/policies" className="hover:text-[#1e3a8a]">
                Escrow Rules
              </Link>
            </li>
            <li>
              <Link href="/policies#revisions" className="hover:text-[#1e3a8a]">
                Revisions
              </Link>
            </li>
            <li>
              <Link href="/policies#integrity" className="hover:text-[#1e3a8a]">
                Integrity Charter
              </Link>
            </li>
            <li>
              <Link href="/auth/verify" className="hover:text-[#1e3a8a]">
                Verification
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#e6e0d4] py-4 text-center text-[11px] font-tech text-stone-500">
        Tovolana Writers · Valid Until never invalidates confirmed booking delivery deadlines
      </div>
    </footer>
  );
}
