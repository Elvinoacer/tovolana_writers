import React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CheckCircle2, ExternalLink, FileText, Star } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isFutureTimestamp, isUserProActive } from "@/lib/pricing";
import {
  isAllowedNextImageSrc,
  isSafeMediaDisplayUrl,
  isSafeRasterImageMimeOrExt,
} from "@/lib/upload-constants";
import { TaskCard } from "@/components/TaskCard";
import { VettedCreatorBadge, formatCreatorTier } from "@/components/ui/Badges";
import { ScoreRing } from "@/components/ui/EditorialVisuals";
import { AuroraHeading, HudCard, RadarAvatar } from "@/components/ui/AuroraPrimitives";

export const dynamic = "force-dynamic";

export default async function PublicCreatorProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await getCurrentUser();
  const userIsPro = user
    ? isUserProActive(user.membershipTier, user.proExpiresAt)
    : false;

  const [creator, config] = await Promise.all([
    db.creatorProfile.findUnique({
      where: { username },
      include: {
        user: { select: { avatarUrl: true } },
        listings: {
          where: {
            status: "PUBLISHED",
            validUntil: { gt: new Date() },
          },
          include: {
            category: { select: { id: true, slug: true, name: true } },
            creator: {
              select: {
                id: true,
                username: true,
                displayName: true,
                headline: true,
                ratingAverage: true,
                completedBookingsCount: true,
                assessmentScore: true,
                creatorTier: true,
                isAvailable: true,
                onTimeDeliveryRate: true,
                user: { select: { avatarUrl: true } },
              },
            },
            _count: { select: { reviews: true } },
          },
          orderBy: { publishedAt: "desc" },
        },
        reviewsReceived: {
          where: { isPublic: true },
          include: {
            customer: { select: { name: true } },
            task: { select: { slug: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    }),
    db.platformConfig.findUnique({ where: { id: "global" } }),
  ]);

  if (!creator || creator.applicationStatus !== "APPROVED") {
    notFound();
  }

  const samples = Array.isArray(creator.portfolioSamples)
    ? (creator.portfolioSamples as Array<{
        title: string;
        category: string;
        excerpt: string;
        url?: string;
        attachmentUrl?: string;
        attachmentName?: string;
        attachmentAssetId?: string;
        mimeType?: string;
      }>)
    : [];

  const availableNowActive = isFutureTimestamp(creator.availableNowBadgeUntil);
  const featuredSpotlightActive = isFutureTimestamp(creator.featuredProfileUntil);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-reveal">
      {/* Dark Aurora Creator Banner */}
      <HudCard
        theme="cyan"
        brackets
        className="p-6 sm:p-8 ink-grid-bg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      >
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <VettedCreatorBadge />
            {creator.creatorTier && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  creator.creatorTier === "ELITE"
                    ? "bg-amber-500/15 text-amber-300 border-amber-400/35"
                    : creator.creatorTier === "TOP_RATED"
                      ? "bg-sky-500/15 text-sky-300 border-sky-400/35"
                      : "bg-teal-500/15 text-teal-300 border-teal-400/35"
                }`}
              >
                {formatCreatorTier(creator.creatorTier)}
              </span>
            )}
            {availableNowActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Available Now
              </span>
            )}
            {featuredSpotlightActive && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/25 text-sky-200 border border-sky-400/45">
                Featured
              </span>
            )}
            {creator.taglineBadge && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/[0.06] text-slate-200 border border-white/[0.14]">
                {creator.taglineBadge}
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                creator.isAvailable
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/35"
                  : "bg-white/[0.06] text-slate-300 border-white/[0.14]"
              }`}
            >
              {creator.isAvailable ? "Taking Orders" : "Busy right now"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <RadarAvatar
              name={creator.displayName}
              avatarUrl={creator.user?.avatarUrl}
              available={creator.isAvailable}
              theme="cyan"
              size="lg"
            />
            <div>
              <AuroraHeading as="h1" className="text-3xl">
                {creator.displayName}
              </AuroraHeading>
              <p className="text-xs font-tech text-slate-400">
                @{creator.username}
              </p>
              <p className="text-sm font-medium text-sky-300 mt-0.5">
                {creator.headline}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            {creator.bio}
          </p>

          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            {creator.educationCredentials && (
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.12] text-slate-200 font-medium">
                {creator.educationCredentials}
              </span>
            )}
            {typeof creator.yearsExperience === "number" &&
              creator.yearsExperience > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.12] font-tech text-slate-300">
                  {creator.yearsExperience}+ years experience
                </span>
              )}
            {typeof creator.responseTimeMinutes === "number" && (
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.12] font-tech text-slate-300">
                Replies in ~{creator.responseTimeMinutes} mins
              </span>
            )}
            {typeof creator.onTimeDeliveryRate === "number" && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/35 font-tech text-emerald-300">
                {creator.onTimeDeliveryRate}% on time
              </span>
            )}
            {typeof creator.profileCompletenessScore === "number" && (
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/35 font-tech text-sky-300">
                {creator.profileCompletenessScore}% profile strength
              </span>
            )}
            {creator.introVideoUrl && (
              <a
                href={creator.introVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-300 font-semibold hover:bg-amber-500/25"
              >
                Watch short intro ↗
              </a>
            )}
          </div>

          <div className="rounded-xl border border-sky-400/30 bg-sky-500/[0.08] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">
                Have a custom project for {creator.displayName}?
              </p>
              <p className="text-xs text-slate-300">
                Post your job for free and compare offers — or start with a KES 490 Page 1 trial.
              </p>
            </div>
            <Link
              href="/bidding"
              className="btn-primary px-4 py-2 text-xs whitespace-nowrap text-center"
            >
              Post a Job
            </Link>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {creator.writingCategories.map((cat) => (
              <span
                key={cat}
                className="text-xs px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.12] text-slate-200 font-medium"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Triple Visual Gauge Card */}
        <div className="lg:col-span-5 grid grid-cols-3 gap-3 bg-white/[0.04] p-5 rounded-2xl border border-white/[0.12] text-center">
          <ScoreRing
            score={creator.assessmentScore ?? 90}
            size={84}
            tone="emerald"
            sublabel="Test Score"
          />
          <ScoreRing
            score={(creator.ratingAverage / 5) * 100}
            label={`${creator.ratingAverage.toFixed(1)}★`}
            size={84}
            tone="gold"
            sublabel="Client Rating"
          />
          <div className="flex flex-col items-center justify-center">
            <div className="w-[84px] h-[84px] rounded-full border-[7px] border-sky-400/40 bg-[#060b14] flex flex-col items-center justify-center">
              <span className="font-tech text-xl font-bold text-sky-300">
                {creator.completedBookingsCount}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-1">
              Orders Done
            </span>
          </div>
        </div>
      </HudCard>

      {/* Portfolio Excerpts */}
      {samples.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-editorial text-2xl font-semibold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-teal-300" />
            Writing Samples
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {samples.map((s, idx) => {
              const trimmedAttachment = s.attachmentUrl?.trim() || "";
              const safeAttachment = isSafeMediaDisplayUrl(trimmedAttachment)
                ? trimmedAttachment
                : null;
              const trimmedExternal = s.url?.trim() || "";
              const safeExternalUrl = isSafeMediaDisplayUrl(trimmedExternal)
                ? trimmedExternal
                : null;
              const isRasterAttachment = Boolean(
                safeAttachment &&
                  isSafeRasterImageMimeOrExt(s.mimeType, safeAttachment)
              );
              const canPreviewNextImage = Boolean(
                isRasterAttachment &&
                  safeAttachment &&
                  isAllowedNextImageSrc(safeAttachment)
              );

              return (
                <div
                  key={idx}
                  className="editorial-card p-6 border-l-4 border-l-teal-400 space-y-3"
                >
                  <span className="inline-block text-[10px] font-tech uppercase px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-400/35 font-semibold">
                    {s.category}
                  </span>
                  <h3 className="font-editorial text-lg font-semibold text-white">
                    {s.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {s.excerpt}
                  </p>

                  {canPreviewNextImage && safeAttachment && (
                    <a
                      href={safeAttachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-xl border border-white/[0.12] bg-[#060b14]"
                    >
                      <Image
                        src={safeAttachment}
                        alt={s.attachmentName || s.title}
                        width={640}
                        height={320}
                        unoptimized={safeAttachment.startsWith("/api/")}
                        className="w-full h-44 object-cover hover:scale-[1.02] transition-transform duration-300"
                      />
                    </a>
                  )}

                  {(safeAttachment || safeExternalUrl) && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {safeAttachment && (
                        <a
                          href={safeAttachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-400/35 text-xs font-semibold text-teal-200 hover:bg-teal-500/25 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[220px]">
                            {s.attachmentName ||
                              (isRasterAttachment
                                ? "View Sample Image"
                                : "Open Sample File")}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                      {safeExternalUrl && safeExternalUrl !== safeAttachment && (
                        <a
                          href={safeExternalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.12] text-xs font-medium text-sky-300 hover:bg-sky-500/15 transition-colors"
                        >
                          <span>Reference Link</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Active Services */}
      <section className="space-y-4">
        <AuroraHeading as="h2" className="text-2xl">
          Services ({creator.listings.length})
        </AuroraHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creator.listings.map((task, idx) => (
            <TaskCard
              key={task.id}
              task={task}
              standardFeePct={config?.standardServiceFeePct ?? 10}
              proDiscountPct={config?.proFeeDiscountPct ?? 50}
              userIsPro={userIsPro}
              index={idx}
            />
          ))}
        </div>
      </section>

      {/* Reviews */}
      {creator.reviewsReceived.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-editorial text-2xl font-semibold text-white">
            Client Reviews
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creator.reviewsReceived.map((rev) => (
              <div key={rev.id} className="editorial-card p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    {rev.customer.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-tech text-amber-300 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {rev.rating}.0
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {rev.comment}
                </p>
                <Link
                  href={`/tasks/${rev.task.slug}`}
                  className="text-xs font-medium text-sky-300 hover:underline block"
                >
                  {rev.task.title}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
