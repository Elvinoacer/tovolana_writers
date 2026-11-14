"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MailCheck, ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "@/components/AuthContext";

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
    setEmailStatus("Verifying...");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: emailToken }),
    });
    const json = await res.json();
    if (!res.ok) {
      setEmailStatus(json.error?.message || "Invalid verification token.");
      return;
    }
    setEmailStatus("Email verified cleanly.");
    await refresh();
  }

  async function resendEmailToken() {
    setEmailStatus("Generating token...");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok) {
      setEmailStatus(json.error?.message || "Could not send token.");
      return;
    }
    if (json.data?.verificationPreviewToken) {
      setEmailToken(json.data.verificationPreviewToken);
    }
    setEmailStatus("Verification token ready.");
  }

  async function sendPhoneOtp() {
    setPhoneStatus("Sending 6-digit OTP...");
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPhoneStatus(json.error?.message || "Could not dispatch OTP.");
      return;
    }
    if (json.data?.sandboxOtpPreview) {
      setOtpPreview(json.data.sandboxOtpPreview);
    }
    setPhoneStatus(`Sent to ${json.data.phone} (10m window).`);
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
      setPhoneStatus(json.error?.message || "OTP verification failed.");
      return;
    }
    setPhoneStatus("Phone verified cleanly.");
    await refresh();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-reveal">
      <div className="editorial-card p-6 bg-white ink-grid-bg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wider text-[#1e3a8a]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Security Trust Center
          </span>
          <h1 className="font-editorial text-3xl font-semibold mt-1 text-[#111827]">
            Verify Email &amp; M-Pesa Phone
          </h1>
        </div>
        <Link href="/dashboard/settings" className="btn-ghost px-4 py-2 text-xs">
          Back to Settings
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="editorial-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-[#1e3a8a]" />
              Email Token
            </h2>
            {user?.emailVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f766e] bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
          </div>
          <form onSubmit={verifyEmailNow} className="space-y-3">
            <input
              type="text"
              value={emailToken}
              onChange={(e) => setEmailToken(e.target.value)}
              placeholder="Paste verification token"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#e6e0d4] bg-[#faf7f2] font-tech"
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 py-2.5 text-xs">
                Verify Email
              </button>
              {user && (
                <button
                  type="button"
                  onClick={resendEmailToken}
                  className="btn-ghost px-3.5 py-2.5 text-xs"
                >
                  Generate
                </button>
              )}
            </div>
          </form>
          {emailStatus && (
            <p className="text-xs font-medium text-stone-700">{emailStatus}</p>
          )}
        </div>

        <div className="editorial-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl font-semibold flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#0f766e]" />
              Phone SMS OTP
            </h2>
            {user?.phoneVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f766e] bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
          </div>
          {!user ? (
            <p className="text-xs text-stone-600">
              <Link href="/auth" className="text-[#1e3a8a] font-semibold underline">
                Sign in
              </Link>{" "}
              to verify your M-Pesa phone number.
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678"
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-[#e6e0d4] bg-[#faf7f2] font-tech"
                />
                <button
                  type="button"
                  onClick={sendPhoneOtp}
                  className="btn-creator px-4 py-2.5 text-xs"
                >
                  Send OTP
                </button>
              </div>
              {otpPreview && (
                <p className="text-xs font-tech bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-amber-900">
                  Sandbox OTP: <strong>{otpPreview}</strong>
                </p>
              )}
              <form onSubmit={verifyPhoneCode} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit OTP"
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-[#e6e0d4] bg-[#faf7f2] font-tech"
                />
                <button type="submit" className="btn-dark px-4 py-2.5 text-xs">
                  Verify Code
                </button>
              </form>
              {phoneStatus && (
                <p className="text-xs font-medium text-stone-700">{phoneStatus}</p>
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
        <div className="p-12 text-center text-sm text-stone-500">
          Loading verification controls...
        </div>
      }
    >
      <VerifyCenterInner />
    </Suspense>
  );
}
