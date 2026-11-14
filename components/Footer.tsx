import React from "react";
import Link from "next/link";
import { Feather, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[#e6e0d4] bg-[#f2ede3]/70 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#1e3a8a] text-white flex items-center justify-center">
              <Feather className="w-4 h-4" />
            </span>
            <span className="font-editorial text-lg font-semibold">
              Tovolana Writers
            </span>
          </div>
          <p className="text-sm text-stone-600 leading-relaxed">
            Transparent marketplace connecting clients with assessment-vetted
            writing Creators. Built with escrow protection and explicit delivery
            milestones.
          </p>
          <div className="inline-flex items-center gap-1.5 text-xs text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            Free Core Booking Access + Pro Discounts
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-sm text-stone-900 mb-3">
            Marketplace
          </h4>
          <ul className="space-y-2 text-sm text-stone-600">
            <li>
              <Link href="/explore" className="hover:text-[#1e3a8a]">
                Explore All Services
              </Link>
            </li>
            <li>
              <Link
                href="/explore?category=academic-writing"
                className="hover:text-[#1e3a8a]"
              >
                Academic Writing
              </Link>
            </li>
            <li>
              <Link
                href="/explore?category=research-papers"
                className="hover:text-[#1e3a8a]"
              >
                Research Papers
              </Link>
            </li>
            <li>
              <Link
                href="/explore?category=business-writing-and-proposals"
                className="hover:text-[#1e3a8a]"
              >
                Business &amp; Proposals
              </Link>
            </li>
            <li>
              <Link href="/membership" className="hover:text-[#1e3a8a]">
                Free vs Pro Benefits
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-sm text-stone-900 mb-3">
            Creators &amp; Workspaces
          </h4>
          <ul className="space-y-2 text-sm text-stone-600">
            <li>
              <Link href="/creators-hub/join" className="hover:text-[#1e3a8a]">
                Become a Creator (No ID Barrier)
              </Link>
            </li>
            <li>
              <Link href="/creators-hub" className="hover:text-[#1e3a8a]">
                Creators Hub
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-[#1e3a8a]">
                Customer Dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin" className="hover:text-[#1e3a8a]">
                Administrator Console
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-sm text-stone-900 mb-3">
            Governance &amp; Policies
          </h4>
          <ul className="space-y-2 text-sm text-stone-600">
            <li>
              <Link href="/policies" className="hover:text-[#1e3a8a]">
                Booking &amp; Escrow Policy
              </Link>
            </li>
            <li>
              <Link href="/policies#revisions" className="hover:text-[#1e3a8a]">
                Revision &amp; Refund Rules
              </Link>
            </li>
            <li>
              <Link href="/policies#integrity" className="hover:text-[#1e3a8a]">
                Academic Integrity Charter
              </Link>
            </li>
            <li>
              <Link href="/auth" className="hover:text-[#1e3a8a]">
                Sign In / Verification
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#e6e0d4] py-4 text-center text-xs text-stone-500">
        Tovolana Writers Platform v1.0 · Listing validity windows never
        invalidate confirmed booking delivery deadlines.
      </div>
    </footer>
  );
}
