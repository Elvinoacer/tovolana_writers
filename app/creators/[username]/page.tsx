import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CheckCircle2, Star } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isUserProActive } from "@/lib/pricing";
import { TaskCard } from "@/components/TaskCard";
import { VettedCreatorBadge } from "@/components/ui/Badges";

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="editorial-card p-6 sm:p-8 bg-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <VettedCreatorBadge />
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                creator.isAvailable
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-stone-100 text-stone-700 border-stone-200"
              }`}
            >
              {creator.isAvailable
                ? "Accepting New Bookings"
                : "Currently at Capacity"}
            </span>
          </div>

          <h1 className="font-editorial text-3xl font-semibold text-[#111827]">
            {creator.displayName}{" "}
            <span className="text-base font-tech text-stone-500 font-normal">
              @{creator.username}
            </span>
          </h1>
          <p className="text-base font-medium text-[#1e3a8a]">
            {creator.headline}
          </p>
          <p className="text-sm text-stone-600 leading-relaxed max-w-3xl">
            {creator.bio}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {creator.writingCategories.map((cat) => (
              <span
                key={cat}
                className="text-xs px-2.5 py-1 rounded-md bg-[#faf7f2] border border-[#e6e0d4] text-stone-700"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] text-center">
            <p className="text-2xl font-bold font-tech text-[#111827] flex items-center justify-center gap-1">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              {creator.ratingAverage.toFixed(1)}
            </p>
            <p className="text-xs text-stone-500 mt-1">Average Rating</p>
          </div>
          <div className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6e0d4] text-center">
            <p className="text-2xl font-bold font-tech text-[#111827]">
              {creator.completedBookingsCount}
            </p>
            <p className="text-xs text-stone-500 mt-1">Delivered Orders</p>
          </div>
          <div className="col-span-2 p-4 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between">
            <div>
              <p className="text-xs text-teal-900 font-semibold">
                Assessment Score
              </p>
              <p className="text-xs text-teal-700">6-Criteria Rubric Vetted</p>
            </div>
            <p className="text-2xl font-bold font-tech text-teal-900">
              {creator.assessmentScore ?? 90}/100
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Excerpts */}
      {samples.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-editorial text-2xl font-semibold flex items-center gap-2">
            <Award className="w-5 h-5 text-teal-700" />
            Verified Writing Samples
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {samples.map((s, idx) => (
              <div key={idx} className="editorial-card p-5 space-y-2">
                <span className="text-[11px] font-tech uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                  {s.category}
                </span>
                <h3 className="font-editorial text-lg font-semibold">
                  {s.title}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {s.excerpt}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Published Services */}
      <section className="space-y-4">
        <h2 className="font-editorial text-2xl font-semibold">
          Active Services by {creator.displayName} ({creator.listings.length})
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
                  <span className="text-sm font-semibold inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-700" />
                    {rev.customer.name}
                  </span>
                  <span className="text-xs font-tech text-amber-700">
                    {rev.rating}/5 ★
                  </span>
                </div>
                <p className="text-sm text-stone-700">{rev.comment}</p>
                <Link
                  href={`/tasks/${rev.task.slug}`}
                  className="text-xs text-[#1e3a8a] hover:underline block"
                >
                  Service: {rev.task.title}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
