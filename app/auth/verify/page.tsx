"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MailCheck, ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { AuroraHeading } from "@/components/ui/AuroraPrimitives";
import { NextStepBanner } from "@/components/ui/FlowGuide";

function VerifyCenterInner() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";
  const { user, refresh } = useAuth();

  const [emailToken, setEmailToken] = useState(initialToken);
  const [emailStatus, setEmailStatus] = useState("");
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const phone = phoneOverride ?? user?.phone ?? "0712345678";
  const setPhone = (val: string) => setPhoneOverride(val);
  const [otpCode, setOtpCode] = useState("");
  const [otpPreview, setOtpPreview] = useState("");
  const [phoneStatus, setPhoneStatus] = useState("");

  async function verifyEmailNow(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus("Checking...");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: emailToken }),
    });
    const json = await res.json();
    if (!res.ok) {
      setEmailStatus(json.error?.message || "That code did not work. Please check and try again.");
      return;
    }
    setEmailStatus("Email confirmed!");
    await refresh();
  }

  async function resendEmailToken() {
    setEmailStatus("Getting a code...");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok) {
      setEmailStatus(json.error?.message || "Could not get a code right now.");
      return;
    }
    if (json.data?.verificationPreviewToken) {
      setEmailToken(json.data.verificationPreviewToken);
    }
    setEmailStatus("Your email code is ready below.");
  }

  async function sendPhoneOtp() {
    setPhoneStatus("Sending 6-digit code...");
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPhoneStatus(json.error?.message || "Could not send SMS code.");
      return;
    }
    if (json.data?.sandboxOtpPreview) {
      setOtpPreview(json.data.sandboxOtpPreview);
    }
    setPhoneStatus(`Code sent to ${json.data.phone} (good for 10 minutes).`);
  }

  async function verifyPhoneCode(e: React.FormEvent) {
    e.preventDefault();
    setPhoneStatus("Checking code...");
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code: otpCode }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPhoneStatus(json.error?.message || "That 6-digit code did not match.");
      return;
    }
    setPhoneStatus("Phone number confirmed!");
    await refresh();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-reveal">
      <div className="editorial-card p-6 ink-grid-bg border-sky-400/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider text-sky-300 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Account Check
          </span>
          <AuroraHeading as="h1" className="text-3xl mt-1">
            Confirm Email &amp; M-Pesa Phone
          </AuroraHeading>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Confirm your details so M-Pesa prompts and order alerts reach you on time.
          </p>
        </div>
        <Link href="/dashboard/settings" className="btn-ghost px-4 py-2 text-xs shrink-0">
          Back to Settings
        </Link>
      </div>

      {user && (
        <NextStepBanner
          tone={user.emailVerified && user.phoneVerified ? "emerald" : "blue"}
          eyebrow={user.emailVerified && user.phoneVerified ? "All done" : "What to do"}
          now={
            user.emailVerified && user.phoneVerified
              ? "Your email and M-Pesa phone number are both confirmed."
              : !user.phoneVerified
                ? "Your M-Pesa phone number is not confirmed yet."
                : "Your email is not confirmed yet."
          }
          next={
            user.emailVerified && user.phoneVerified
              ? "You are ready to pay via M-Pesa and get order alerts."
              : "Tap Send Code below and enter the 6-digit code."
          }
          goal="Smooth M-Pesa payments and instant order updates."
          actionLabel={user.emailVerified && user.phoneVerified ? "Go to My Orders" : undefined}
          actionHref={user.emailVerified && user.phoneVerified ? "/dashboard" : undefined}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="editorial-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl font-semibold text-white flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-sky-300" />
              1. Confirm Email
            </h2>
            {user?.emailVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-300 bg-teal-500/15 px-2.5 py-0.5 rounded-full border border-teal-400/35">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmed
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300">
            Get a code and submit it below to confirm your email address.
          </p>
          <form onSubmit={verifyEmailNow} className="space-y-3">
            <input
              type="text"
              value={emailToken}
              onChange={(e) => setEmailToken(e.target.value)}
              placeholder="Paste email code here"
              className="hud-input w-full px-3.5 py-2.5 text-sm font-tech"
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 py-2.5 text-xs">
                Confirm Email
              </button>
              {user && (
                <button
                  type="button"
                  onClick={resendEmailToken}
                  className="btn-ghost px-3.5 py-2.5 text-xs"
                >
                  Get Code
                </button>
              )}
            </div>
          </form>
          {emailStatus && (
            <p className="text-xs font-medium text-cyan-200">{emailStatus}</p>
          )}
        </div>

        <div className="editorial-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-teal-300" />
              2. Confirm M-Pesa Phone
            </h2>
            {user?.phoneVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-300 bg-teal-500/15 px-2.5 py-0.5 rounded-full border border-teal-400/35">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmed
              </span>
            )}
          </div>
          {!user ? (
            <p className="text-xs text-slate-300">
              <Link href="/auth" className="text-sky-300 font-semibold underline">
                Sign in
              </Link>{" "}
              to confirm your M-Pesa phone number.
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678"
                  className="hud-input flex-1 px-3.5 py-2.5 text-sm font-tech"
                />
                <button
                  type="button"
                  onClick={sendPhoneOtp}
                  className="btn-creator px-4 py-2.5 text-xs"
                >
                  Send Code
                </button>
              </div>
              {otpPreview && (
                <p className="text-xs font-tech bg-amber-500/15 border border-amber-400/35 p-2.5 rounded-xl text-amber-200">
                  Test Mode Code: <strong>{otpPreview}</strong>
                </p>
              )}
              <form onSubmit={verifyPhoneCode} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit code"
                  className="hud-input flex-1 px-3.5 py-2.5 text-sm font-tech"
                />
                <button type="submit" className="btn-dark px-4 py-2.5 text-xs">
                  Confirm Number
                </button>
              </form>
              {phoneStatus && (
                <p className="text-xs font-medium text-cyan-200">{phoneStatus}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm text-slate-400">
          Loading verification controls...
        </div>
      }
    >
      <VerifyCenterInner />
    </Suspense>
  );
}
