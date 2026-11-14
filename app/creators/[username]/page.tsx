import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CheckCircle2, Star } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isUserProActive } from "@/lib/pricing";
import { TaskCard } from "@/components/TaskCard";
import { VettedCreatorBadge } from "@/components/ui/Badges";
import { CreatorAvatar, ScoreRing } from "@/components/ui/EditorialVisuals";

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
                ratingAverage: true,
                completedBookingsCount: true,
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
      }>)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-reveal">
      {/* Editorial Creator Banner */}
      <div className="editorial-card p-6 sm:p-8 bg-white ink-grid-bg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <VettedCreatorBadge />
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                creator.isAvailable
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-stone-100 text-stone-700 border-stone-200"
              }`}
            >
              {creator.isAvailable ? "Accepting Bookings" : "At Capacity"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <CreatorAvatar
              name={creator.displayName}
              username={creator.username}
              available={creator.isAvailable}
              size="lg"
            />
            <div>
              <h1 className="font-editorial text-3xl font-semibold text-[#111827]">
                {creator.displayName}
              </h1>
              <p className="text-xs font-tech text-stone-500">
                @{creator.username}
              </p>
              <p className="text-sm font-medium text-[#1e3a8a] mt-0.5">
                {creator.headline}
              </p>
            </div>
          </div>

          <p className="text-sm text-stone-600 leading-relaxed max-w-2xl">
            {creator.bio}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {creator.writingCategories.map((cat) => (
              <span
                key={cat}
                className="text-xs px-3 py-1 rounded-full bg-[#faf7f2] border border-[#e6e0d4] text-stone-800 font-medium"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Triple Visual Gauge Card */}
        <div className="lg:col-span-5 grid grid-cols-3 gap-3 bg-[#faf7f2] p-5 rounded-2xl border border-[#e6e0d4] text-center">
          <ScoreRing
            score={creator.assessmentScore ?? 90}
            size={84}
            tone="emerald"
            sublabel="Rubric Score"
          />
          <ScoreRing
            score={(creator.ratingAverage / 5) * 100}
            label={`${creator.ratingAverage.toFixed(1)}★`}
            size={84}
            tone="gold"
            sublabel="Client Rating"
          />
          <div className="flex flex-col items-center justify-center">
            <div className="w-[84px] h-[84px] rounded-full border-[7px] border-blue-200 bg-white flex flex-col items-center justify-center">
              <span className="font-tech text-xl font-bold text-[#1e3a8a]">
                {creator.completedBookingsCount}
              </span>
            </div>
            <span className="text-[11px] font-medium text-stone-600 mt-1">
              Delivered
            </span>
          </div>
        </div>
      </div>

      {/* Portfolio Excerpts */}
      {samples.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-editorial text-2xl font-semibold flex items-center gap-2">
            <Award className="w-5 h-5 text-[#0f766e]" />
            Writing Samples
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {samples.map((s, idx) => (
              <div
                key={idx}
                className="editorial-card p-6 bg-white border-l-4 border-l-[#0f766e] space-y-2"
              >
                <span className="text-[10px] font-tech uppercase px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0f766e] border border-teal-200 font-semibold">
                  {s.category}
                </span>
                <h3 className="font-editorial text-lg font-semibold text-[#111827]">
                  {s.title}
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {s.excerpt}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Services */}
      <section className="space-y-4">
        <h2 className="font-editorial text-2xl font-semibold">
          Active Services ({creator.listings.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creator.listings.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              standardFeePct={config?.standardServiceFeePct ?? 10}
              proDiscountPct={config?.proFeeDiscountPct ?? 50}
              userIsPro={userIsPro}
            />
          ))}
        </div>
      </section>

      {/* Reviews */}
      {creator.reviewsReceived.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-editorial text-2xl font-semibold">
            Client Feedback
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creator.reviewsReceived.map((rev) => (
              <div key={rev.id} className="editorial-card p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0f766e]" />
                    {rev.customer.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-tech text-amber-700 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {rev.rating}.0
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed">
                  {rev.comment}
                </p>
                <Link
                  href={`/tasks/${rev.task.slug}`}
                  className="text-xs font-medium text-[#1e3a8a] hover:underline block"
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
