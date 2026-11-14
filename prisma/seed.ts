import "dotenv/config";
import crypto from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required to seed the database.");
}
const pool = new Pool({ connectionString });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const now = new Date();
  const daysFromNow = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 1. PlatformConfig
  await db.platformConfig.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      standardServiceFeePct: 10,
      proFeeDiscountPct: 50,
      proMonthlyPrice: 2500,
      proAnnualPrice: 24000,
      currency: "KES",
      archiveRecoveryDays: 14,
      defaultRevisionLimit: 2,
      proEarlyAccessHours: 24,
      announcementBanner:
        "Tovolana Writers v1.0: All Creators are vetted exclusively through our 6-criteria writing assessment — zero paperwork barriers, transparent KES pricing, and escrow-protected deadlines.",
      academicIntegrityPolicy:
        "All commissioned research papers, essays, and editorial guides are delivered strictly as original model work, research synthesis, and editing assistance. Creators pledge 100% original human authorship without plagiarism.",
      revisionPolicyText:
        "Every confirmed booking includes up to the listing's stated revision quota (default 2 rounds) within 7 days of delivery when instructions from the original brief require refinement.",
      cancellationPolicyText:
        "Bookings cancelled prior to creator acceptance qualify for a full refund review. Once work is in progress, administrators mediate fair partial or escrow-based resolution based on milestone evidence.",
    },
  });

  // 2. AssessmentConfig
  const existingConfig = await db.assessmentConfig.findFirst({
    where: { isActive: true },
  });
  const assessmentConfig =
    existingConfig ??
    (await db.assessmentConfig.create({
      data: {
        title: "Editorial Rigor, Research Synthesis & Originality Evaluation",
        promptText:
          "Write a structured, well-reasoned 350-600 word essay analyzing how transparent scoping, source verification, and clear delivery milestones improve trust in digital knowledge marketplaces. Include at least one concrete example and cite at least two analytical sources or perspectives clearly.",
        minWords: 350,
        maxWords: 600,
        durationMinutes: 45,
        passScoreThreshold: 75,
        reviewScoreThreshold: 60,
        cooldownDays: 14,
        rubricWeights: {
          grammar: 0.25,
          coherence: 0.2,
          instruction: 0.2,
          originality: 0.15,
          tone: 0.1,
          research: 0.1,
        },
        isActive: true,
      },
    }));

  // 3. Categories (7 official categories per PRD Section 4.1)
  const categorySeeds = [
    {
      slug: "academic-writing",
      name: "Academic Writing",
      description:
        "Rigorous scholarly literature reviews, capstone guidance, methodology structuring, and academic manuscripts.",
      sortOrder: 1,
      requirementsSchema: [
        { key: "topic", label: "Research Topic / Thesis Question", type: "text", required: true },
        { key: "academicLevel", label: "Academic Level", type: "select", options: ["Undergraduate", "Master's", "Doctoral / Postgrad"], required: true },
        { key: "wordCount", label: "Target Word Count", type: "number", required: true },
        { key: "citationStyle", label: "Referencing Style", type: "select", options: ["APA 7th", "MLA 9th", "Chicago", "Harvard", "IEEE"], required: true },
        { key: "fileFormat", label: "Preferred Deliverable Format", type: "select", options: ["DOCX", "PDF", "LaTeX / ZIP"], required: true },
        { key: "instructions", label: "Detailed Brief & Required Sources", type: "textarea", required: true },
      ],
    },
    {
      slug: "essays-and-assignments",
      name: "Essays and Assignments",
      description:
        "Argumentative, analytical, reflective, and comparative essays crafted with clear thesis structure and formatting.",
      sortOrder: 2,
      requirementsSchema: [
        { key: "topic", label: "Essay Prompt / Question", type: "text", required: true },
        { key: "wordCount", label: "Word Count / Page Target", type: "number", required: true },
        { key: "citationStyle", label: "Referencing Format", type: "select", options: ["APA 7th", "MLA 9th", "Harvard", "No Citation Required"], required: true },
        { key: "instructions", label: "Grading Rubric & Key Arguments", type: "textarea", required: true },
      ],
    },
    {
      slug: "research-papers",
      name: "Research Papers",
      description:
        "Empirical and secondary research reports, systematic reviews, data interpretation, and journal-ready drafts.",
      sortOrder: 3,
      requirementsSchema: [
        { key: "topic", label: "Research Focus", type: "text", required: true },
        { key: "wordCount", label: "Target Length (Words)", type: "number", required: true },
        { key: "citationStyle", label: "Citation Standard", type: "select", options: ["APA 7th", "IEEE", "Nature", "Harvard"], required: true },
        { key: "sourcesRequired", label: "Minimum Peer-Reviewed Sources", type: "number", required: true },
        { key: "instructions", label: "Methodology, Datasets & Objectives", type: "textarea", required: true },
      ],
    },
    {
      slug: "articles-and-blog-writing",
      name: "Articles and Blog Writing",
      description:
        "SEO-informed thought leadership, long-form editorial journalism, newsletters, and technical explainers.",
      sortOrder: 4,
      requirementsSchema: [
        { key: "topic", label: "Headline / Article Angle", type: "text", required: true },
        { key: "targetAudience", label: "Reader Persona & Publication Tone", type: "text", required: true },
        { key: "wordCount", label: "Target Word Count", type: "number", required: true },
        { key: "instructions", label: "Keywords, Outline & Reference Links", type: "textarea", required: true },
      ],
    },
    {
      slug: "business-writing-and-proposals",
      name: "Business Writing and Proposals",
      description:
        "Executive grant proposals, investor decks, SOPs, whitepapers, RFP responses, and strategy memos.",
      sortOrder: 5,
      requirementsSchema: [
        { key: "topic", label: "Proposal / Document Title", type: "text", required: true },
        { key: "industry", label: "Industry & Stakeholder Audience", type: "text", required: true },
        { key: "wordCount", label: "Approximate Scope (Pages/Words)", type: "number", required: true },
        { key: "instructions", label: "RFP Requirements, Goals & Tone", type: "textarea", required: true },
      ],
    },
    {
      slug: "editing-and-proofreading",
      name: "Editing and Proofreading",
      description:
        "Line-by-line developmental editing, structural clarity polish, citation verification, and tracked changes.",
      sortOrder: 6,
      requirementsSchema: [
        { key: "topic", label: "Manuscript Title & Type", type: "text", required: true },
        { key: "wordCount", label: "Document Word Count", type: "number", required: true },
        { key: "styleGuide", label: "Style Guide (APA, Chicago, Oxford)", type: "text", required: true },
        { key: "instructions", label: "Editing Priorities & Tracked Changes Preference", type: "textarea", required: true },
      ],
    },
    {
      slug: "other-services",
      name: "Other Services",
      description:
        "Custom speeches, curriculum guides, policy briefs, creative scripts, and bespoke editorial retainers.",
      sortOrder: 7,
      requirementsSchema: [
        { key: "topic", label: "Service Scope Summary", type: "text", required: true },
        { key: "wordCount", label: "Estimated Length", type: "number", required: false },
        { key: "instructions", label: "Deliverables & Custom Specifications", type: "textarea", required: true },
      ],
    },
  ];

  const categoriesBySlug: Record<
    string,
    { id: string; slug: string; name: string; requirementsSchema: Prisma.InputJsonValue }
  > = {};
  for (const cat of categorySeeds) {
    const saved = await db.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
        requirementsSchema: cat.requirementsSchema,
      },
      create: cat,
    });
    categoriesBySlug[cat.slug] = {
      id: saved.id,
      slug: saved.slug,
      name: saved.name,
      requirementsSchema: saved.requirementsSchema as Prisma.InputJsonValue,
    };
  }

  const demoPasswordHash = hashPassword("Password123!");

  // 4. Demo Users
  const adminUser = await db.user.upsert({
    where: { email: "admin@tovolana.com" },
    update: {},
    create: {
      email: "admin@tovolana.com",
      name: "Wanjiku Omondi (Admin)",
      phone: "254700100001",
      passwordHash: demoPasswordHash,
      roles: ["CUSTOMER", "ADMIN"],
      adminScopes: [
        "SUPER_ADMIN",
        "MODERATION_ADMIN",
        "FINANCE_ADMIN",
        "SUPPORT_ADMIN",
      ],
      status: "ACTIVE",
      emailVerified: now,
      phoneVerified: now,
      membershipTier: "PRO",
      proExpiresAt: daysFromNow(365),
      customerProfile: { create: {} },
    },
  });

  const creatorUser = await db.user.upsert({
    where: { email: "creator@tovolana.com" },
    update: {},
    create: {
      email: "creator@tovolana.com",
      name: "Amara Njoroge",
      phone: "254711200002",
      passwordHash: demoPasswordHash,
      roles: ["CUSTOMER", "CREATOR"],
      status: "ACTIVE",
      emailVerified: now,
      phoneVerified: now,
      membershipTier: "FREE",
      customerProfile: { create: {} },
    },
  });

  const creatorProfile1 = await db.creatorProfile.upsert({
    where: { userId: creatorUser.id },
    update: {},
    create: {
      userId: creatorUser.id,
      username: "amara_editorial",
      displayName: "Amara Njoroge",
      headline: "Senior Research Synthesizer & Academic Developmental Editor",
      bio: "Former university writing center fellow specializing in empirical literature reviews, APA/Chicago citation precision, and policy research briefs across East Africa and global institutions.",
      writingCategories: [
        "Academic Writing",
        "Research Papers",
        "Editing and Proofreading",
      ],
      academicIntegrityAccepted: true,
      applicationStatus: "APPROVED",
      assessmentScore: 91.5,
      assessmentAttemptCount: 1,
      isAvailable: true,
      autoAcceptBookings: false,
      ratingAverage: 4.9,
      completedBookingsCount: 28,
      portfolioSamples: [
        {
          title: "Systematic Review: FinTech Micro-Credit Adoption in East Africa",
          category: "Research Papers",
          excerpt:
            "Synthesizes 42 peer-reviewed empirical studies comparing mobile collateral scoring models between 2019 and 2025.",
        },
        {
          title: "APA 7th Structural Edit for Climate Resilience Grant Proposal",
          category: "Editing and Proofreading",
          excerpt:
            "Reduced passive voice density by 38% while aligning tables, in-text citations, and executive framing to donor guidelines.",
        },
      ],
    },
  });

  const creatorUser2 = await db.user.upsert({
    where: { email: "creator2@tovolana.com" },
    update: {},
    create: {
      email: "creator2@tovolana.com",
      name: "David Mwangi",
      phone: "254722300003",
      passwordHash: demoPasswordHash,
      roles: ["CUSTOMER", "CREATOR"],
      status: "ACTIVE",
      emailVerified: now,
      phoneVerified: now,
      membershipTier: "PRO",
      proExpiresAt: daysFromNow(180),
      customerProfile: { create: {} },
    },
  });

  const creatorProfile2 = await db.creatorProfile.upsert({
    where: { userId: creatorUser2.id },
    update: {},
    create: {
      userId: creatorUser2.id,
      username: "david_proposals",
      displayName: "David Mwangi",
      headline: "B2B Proposal Strategist & Long-Form Technical Writer",
      bio: "Crafts winning RFP submissions, SaaS technical whitepapers, and executive thought-leadership essays with transparent outlines and milestone check-ins.",
      writingCategories: [
        "Business Writing and Proposals",
        "Articles and Blog Writing",
        "Essays and Assignments",
        "Other Services",
      ],
      academicIntegrityAccepted: true,
      applicationStatus: "APPROVED",
      assessmentScore: 88.0,
      assessmentAttemptCount: 1,
      isAvailable: true,
      autoAcceptBookings: true,
      ratingAverage: 4.8,
      completedBookingsCount: 19,
      portfolioSamples: [
        {
          title: "Series A FinTech Compliance Whitepaper",
          category: "Business Writing and Proposals",
          excerpt:
            "Delivered a 3,200-word regulatory readiness briefing accepted by three institutional venture partners.",
        },
      ],
    },
  });

  const proCustomer = await db.user.upsert({
    where: { email: "pro.customer@tovolana.com" },
    update: {},
    create: {
      email: "pro.customer@tovolana.com",
      name: "Grace Wambui",
      phone: "254733400004",
      passwordHash: demoPasswordHash,
      roles: ["CUSTOMER"],
      status: "ACTIVE",
      emailVerified: now,
      phoneVerified: now,
      membershipTier: "PRO",
      proExpiresAt: daysFromNow(28),
      customerProfile: { create: {} },
    },
  });

  const existingSub = await db.membershipSubscription.findFirst({
    where: { userId: proCustomer.id, status: "ACTIVE" },
  });
  if (!existingSub) {
    const sub = await db.membershipSubscription.create({
      data: {
        userId: proCustomer.id,
        tier: "PRO",
        planInterval: "MONTHLY",
        amount: 2500,
        currency: "KES",
        status: "ACTIVE",
        currentPeriodStart: daysAgo(2),
        currentPeriodEnd: daysFromNow(28),
        autoRenew: true,
      },
    });
    await db.paymentTransaction.create({
      data: {
        subscriptionId: sub.id,
        userId: proCustomer.id,
        purpose: "PRO_SUBSCRIPTION",
        channel: "MPESA_STK",
        apiRef: "seed-pro-grace-001",
        providerInvoiceId: "INV-SEED-PRO-001",
        phone: "254733400004",
        currency: "KES",
        amount: 2500,
        status: "COMPLETE",
        paidAt: daysAgo(2),
      },
    });
  }

  const freeCustomer = await db.user.upsert({
    where: { email: "free.customer@tovolana.com" },
    update: {},
    create: {
      email: "free.customer@tovolana.com",
      name: "Brian Kiprop",
      phone: "254744500005",
      passwordHash: demoPasswordHash,
      roles: ["CUSTOMER"],
      status: "ACTIVE",
      emailVerified: now,
      phoneVerified: now,
      membershipTier: "FREE",
      customerProfile: { create: {} },
    },
  });

  const applicantUser = await db.user.upsert({
    where: { email: "applicant@tovolana.com" },
    update: {},
    create: {
      email: "applicant@tovolana.com",
      name: "Faith Chebet",
      phone: "254755600006",
      passwordHash: demoPasswordHash,
      roles: ["CUSTOMER"],
      status: "ACTIVE",
      emailVerified: now,
      phoneVerified: null,
      membershipTier: "FREE",
      customerProfile: { create: {} },
    },
  });

  const applicantProfile = await db.creatorProfile.upsert({
    where: { userId: applicantUser.id },
    update: {},
    create: {
      userId: applicantUser.id,
      username: "faith_writes",
      displayName: "Faith Chebet",
      headline: "Aspiring Academic & Editorial Analyst",
      bio: "Focused on economics essays, public policy synthesis, and copyediting.",
      writingCategories: ["Essays and Assignments", "Articles and Blog Writing"],
      academicIntegrityAccepted: true,
      applicationStatus: "UNDER_REVIEW",
      assessmentScore: 71.0,
      assessmentAttemptCount: 1,
    },
  });

  const existingAttempt = await db.creatorAssessmentAttempt.findFirst({
    where: { creatorProfileId: applicantProfile.id },
  });
  if (!existingAttempt) {
    await db.creatorAssessmentAttempt.create({
      data: {
        creatorProfileId: applicantProfile.id,
        configId: assessmentConfig.id,
        startedAt: daysAgo(1),
        submittedAt: daysAgo(1),
        responseText:
          "Transparent scoping and source verification fundamentally strengthen trust inside digital knowledge marketplaces. When service briefs explicitly define formatting rules, milestone dates, and citation standards before payment, misunderstandings decline significantly. Furthermore, structured peer-review expectations empower both customers and writers to evaluate quality objectively rather than relying on ambiguous expectations.",
        wordCount: 382,
        grammarScore: 76,
        coherenceScore: 71,
        instructionScore: 74,
        originalityScore: 68,
        toneScore: 72,
        researchScore: 61,
        totalScore: 71.0,
        autoDecision: "UNDER_REVIEW",
        reviewNote: "Borderline citation specificity; awaiting admin review.",
      },
    });
  }

  // 5. Task Listings across all 7 categories and key lifecycle statuses
  const listingSeeds = [
    {
      slug: "systematic-academic-literature-review-2500-words",
      title: "Systematic Academic Literature Review (Up to 2,500 Words)",
      shortDescription:
        "Evidence-led thematic synthesis with APA/Harvard citations, methodology matrix, and annotated bibliography.",
      fullDescription:
        "Comprehensive academic literature review synthesizing peer-reviewed sources around your research question. Includes an initial source outline check-in, full thematic narrative, properly formatted reference list, and two revision rounds.",
      serviceType: "Literature Review",
      categoryId: categoriesBySlug["academic-writing"].id,
      creatorId: creatorProfile1.id,
      createdByAdmin: false,
      pricingType: "FIXED" as const,
      basePrice: 6500,
      deliveryTurnaroundDays: 4,
      maxRevisions: 2,
      manualAcceptanceRequired: true,
      validityType: "STANDARD_30D" as const,
      validUntil: daysFromNow(28),
      deliverablesSummary: [
        "Annotated synthesis table (DOCX + PDF)",
        "2,500-word structured narrative",
        "Verified APA/Chicago/Harvard bibliography",
      ],
      requirementsConfig: categoriesBySlug["academic-writing"].requirementsSchema,
      revisionPolicy: "Up to 2 complimentary revision rounds within 7 days of delivery.",
      cancellationPolicy: "Full cancellation review available prior to creator acceptance.",
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(2),
    },
    {
      slug: "university-analytical-essay-structure-and-drafting",
      title: "Analytical & Argumentative Essay Drafting (1,500 Words)",
      shortDescription:
        "Thesis-driven analytical essay with clear evidence transitions, formatting polish, and citation compliance.",
      fullDescription:
        "Ideal for persuasive, comparative, or critical reflection assignments requiring clear thesis framing, counter-argument analysis, and precise academic referencing.",
      serviceType: "Essay Drafting",
      categoryId: categoriesBySlug["essays-and-assignments"].id,
      creatorId: creatorProfile2.id,
      createdByAdmin: false,
      pricingType: "FIXED" as const,
      basePrice: 3200,
      deliveryTurnaroundDays: 2,
      maxRevisions: 2,
      manualAcceptanceRequired: false,
      validityType: "SHORT_14D" as const,
      validUntil: daysFromNow(12),
      deliverablesSummary: [
        "1,500-word cohesive draft (DOCX)",
        "Formatted reference page",
        "1-paragraph thesis summary",
      ],
      requirementsConfig: categoriesBySlug["essays-and-assignments"].requirementsSchema,
      revisionPolicy: "Includes 2 revision rounds covering rubric alignment.",
      cancellationPolicy: "Standard escrow cancellation rules apply.",
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(2),
    },
    {
      slug: "empirical-research-paper-methodology-and-discussion",
      title: "Empirical Research Paper & Findings Discussion (3,500 Words)",
      shortDescription:
        "Full-structure research paper with abstract, methodology justification, findings interpretation, and IEEE/APA citations.",
      fullDescription:
        "Built for graduate researchers and policy analysts needing publication-grade structuring, critical synthesis of primary findings, and rigorous limitation/recommendation framing.",
      serviceType: "Research Report",
      categoryId: categoriesBySlug["research-papers"].id,
      creatorId: creatorProfile1.id,
      createdByAdmin: false,
      pricingType: "FIXED" as const,
      basePrice: 9500,
      deliveryTurnaroundDays: 5,
      maxRevisions: 3,
      manualAcceptanceRequired: true,
      validityType: "STANDARD_30D" as const,
      validUntil: daysFromNow(25),
      proEarlyAccessUntil: daysFromNow(1), // Pro early access spotlight!
      deliverablesSummary: [
        "3,500-word manuscript with structured sections",
        "Executive abstract & key findings table",
        "15+ peer-reviewed references",
      ],
      requirementsConfig: categoriesBySlug["research-papers"].requirementsSchema,
      revisionPolicy: "Up to 3 structured revision cycles included.",
      cancellationPolicy: "Mediated escrow protection before final acceptance.",
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(1),
    },
    {
      slug: "long-form-editorial-article-and-seo-brief",
      title: "Long-Form Thought Leadership Article (1,800 Words)",
      shortDescription:
        "Journalistic feature article with primary source links, narrative hook, and search-structured subheadings.",
      fullDescription:
        "Designed for SaaS founders, FinTech blogs, and digital magazines seeking authoritative, deeply researched editorial writing free of generic filler.",
      serviceType: "Editorial Article",
      categoryId: categoriesBySlug["articles-and-blog-writing"].id,
      creatorId: creatorProfile2.id,
      createdByAdmin: false,
      pricingType: "FIXED" as const,
      basePrice: 4000,
      deliveryTurnaroundDays: 3,
      maxRevisions: 2,
      manualAcceptanceRequired: false,
      validityType: "STANDARD_30D" as const,
      validUntil: daysFromNow(29),
      deliverablesSummary: [
        "1,800-word publication-ready article",
        "Meta description + 3 headline options",
        "Inline source hyperlinks",
      ],
      requirementsConfig: categoriesBySlug["articles-and-blog-writing"].requirementsSchema,
      revisionPolicy: "2 tone/structure revision rounds included.",
      cancellationPolicy: "Refundable prior to draft outline milestone.",
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(1),
    },
    {
      slug: "grant-and-b2b-rfp-proposal-package",
      title: "Grant & B2B RFP Proposal Package (Custom Executive Scope)",
      shortDescription:
        "Persuasive narrative, budget justification framing, and compliance checklist tailored to donor or enterprise RFPs.",
      fullDescription:
        "Tailored technical and executive proposal authoring with logical framework alignment, risk mitigation tables, and stakeholder impact projections.",
      serviceType: "Business Proposal",
      categoryId: categoriesBySlug["business-writing-and-proposals"].id,
      creatorId: creatorProfile2.id,
      createdByAdmin: false,
      pricingType: "QUOTE_BASED" as const,
      basePrice: 12000,
      deliveryTurnaroundDays: 6,
      maxRevisions: 2,
      manualAcceptanceRequired: true,
      validityType: "ADMIN_CUSTOM" as const,
      validUntil: daysFromNow(45),
      deliverablesSummary: [
        "Complete proposal narrative (DOCX + PDF)",
        "Compliance matrix checklist",
        "Executive summary one-pager",
      ],
      requirementsConfig: categoriesBySlug["business-writing-and-proposals"].requirementsSchema,
      revisionPolicy: "2 executive review & alignment cycles included.",
      cancellationPolicy: "Milestone-backed escrow cancellation policy.",
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(3),
    },
    {
      slug: "thesis-and-manuscript-developmental-editing-5000w",
      title: "Developmental Editing & Citation Polish (Up to 5,000 Words)",
      shortDescription:
        "Comprehensive Track Changes manuscript edit covering flow, academic register, grammar, and bibliography verification.",
      fullDescription:
        "Receive both a tracked-changes DOCX file showing every grammatical and structural improvement and a clean ready-to-submit copy.",
      serviceType: "Editing & Proofreading",
      categoryId: categoriesBySlug["editing-and-proofreading"].id,
      creatorId: creatorProfile1.id,
      createdByAdmin: false,
      pricingType: "FIXED" as const,
      basePrice: 4800,
      deliveryTurnaroundDays: 2,
      maxRevisions: 2,
      manualAcceptanceRequired: false,
      validityType: "STANDARD_30D" as const,
      validUntil: daysFromNow(27),
      deliverablesSummary: [
        "Tracked-changes annotated DOCX",
        "Clean final publication DOCX",
        "Citation consistency audit note",
      ],
      requirementsConfig: categoriesBySlug["editing-and-proofreading"].requirementsSchema,
      revisionPolicy: "2 follow-up refinement passes included.",
      cancellationPolicy: "Full refund prior to edit start.",
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(3),
    },
    {
      slug: "keynote-speech-and-policy-brief-drafting",
      title: "Executive Keynote Speech & Public Policy Brief",
      shortDescription:
        "Compelling 12-minute keynote address or 4-page policy memo structured for parliamentary or corporate briefings.",
      fullDescription:
        "Combines rhetorical cadence with verified statistical talking points so leaders deliver persuasive briefings on schedule.",
      serviceType: "Custom Editorial",
      categoryId: categoriesBySlug["other-services"].id,
      creatorId: creatorProfile2.id,
      createdByAdmin: true,
      pricingType: "FIXED" as const,
      basePrice: 5500,
      deliveryTurnaroundDays: 3,
      maxRevisions: 2,
      manualAcceptanceRequired: false,
      validityType: "STANDARD_30D" as const,
      validUntil: daysFromNow(26),
      deliverablesSummary: [
        "Formatted speech script with pacing cues",
        "1-page fact-sheet appendix",
      ],
      requirementsConfig: categoriesBySlug["other-services"].requirementsSchema,
      revisionPolicy: "2 tone adjustments included.",
      cancellationPolicy: "Standard escrow terms apply.",
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(4),
    },
    // Pending moderation listing
    {
      slug: "rapid-48h-case-study-critical-analysis",
      title: "Rapid 48-Hour Case Study Critical Analysis",
      shortDescription:
        "Focused business or healthcare case study breakdown with SWOT synthesis and actionable recommendations.",
      fullDescription:
        "Submitted by vetted creator Amara Njoroge for administrator moderation approval before going live on marketplace.",
      serviceType: "Case Study",
      categoryId: categoriesBySlug["essays-and-assignments"].id,
      creatorId: creatorProfile1.id,
      createdByAdmin: false,
      pricingType: "FIXED" as const,
      basePrice: 3600,
      deliveryTurnaroundDays: 2,
      maxRevisions: 2,
      manualAcceptanceRequired: false,
      validityType: "SHORT_14D" as const,
      validUntil: null,
      deliverablesSummary: ["1,200-word analysis", "Executive recommendation matrix"],
      requirementsConfig: categoriesBySlug["essays-and-assignments"].requirementsSchema,
      revisionPolicy: "2 revisions included.",
      cancellationPolicy: "Standard escrow policy.",
      status: "PENDING_REVIEW" as const,
      moderationNote: "Awaiting admin pricing & deliverables check.",
    },
    // Changes requested listing
    {
      slug: "investor-pitch-narrative-script-review",
      title: "Investor Pitch Deck Narrative & Script Review",
      shortDescription:
        "Sharpens problem/solution framing, market sizing narrative, and slide speaker notes.",
      fullDescription:
        "Editorial review of investor decks up to 18 slides.",
      serviceType: "Business Pitch",
      categoryId: categoriesBySlug["business-writing-and-proposals"].id,
      creatorId: creatorProfile2.id,
      createdByAdmin: false,
      pricingType: "FIXED" as const,
      basePrice: 4500,
      deliveryTurnaroundDays: 2,
      maxRevisions: 1,
      manualAcceptanceRequired: false,
      validityType: "STANDARD_30D" as const,
      validUntil: null,
      deliverablesSummary: ["Slide-by-slide speaker script", "Rewrite suggestions"],
      requirementsConfig: categoriesBySlug["business-writing-and-proposals"].requirementsSchema,
      revisionPolicy: "1 revision included.",
      cancellationPolicy: "Standard policy.",
      status: "CHANGES_REQUESTED" as const,
      moderationNote:
        "Please specify whether slide financial modeling review is excluded from scope.",
    },
    // Expired listing (still linked to an active IN_PROGRESS booking to demonstrate PRD Rule 2.0!)
    {
      slug: "annual-sustainability-esg-report-edition",
      title: "Annual ESG & Sustainability Impact Report Drafting",
      shortDescription:
        "GRI-aligned sustainability narrative covering governance, social impact, and emissions disclosures.",
      fullDescription:
        "Historical listing whose public validity window expired 5 days ago, yet confirmed bookings continue normally through delivery.",
      serviceType: "ESG Reporting",
      categoryId: categoriesBySlug["business-writing-and-proposals"].id,
      creatorId: creatorProfile1.id,
      createdByAdmin: false,
      pricingType: "FIXED" as const,
      basePrice: 8000,
      deliveryTurnaroundDays: 5,
      maxRevisions: 2,
      manualAcceptanceRequired: false,
      validityType: "STANDARD_30D" as const,
      validUntil: daysAgo(5),
      deliverablesSummary: ["ESG Report Draft", "Stakeholder Metric Summary"],
      requirementsConfig: categoriesBySlug["business-writing-and-proposals"].requirementsSchema,
      revisionPolicy: "2 revisions included.",
      cancellationPolicy: "Standard escrow terms apply.",
      status: "EXPIRED" as const,
      publishedAt: daysAgo(35),
    },
    // Archived listing inside 14-day recovery window
    {
      slug: "nursing-capstone-reflection-portfolio-polish",
      title: "Clinical & Capstone Reflection Portfolio Polish",
      shortDescription:
        "Structured clinical reflection editing with Gibbs/Johns framework coherence and APA referencing.",
      fullDescription:
        "Temporarily archived listing recoverable within the 14-day vault restoration window.",
      serviceType: "Academic Editing",
      categoryId: categoriesBySlug["editing-and-proofreading"].id,
      creatorId: creatorProfile1.id,
      createdByAdmin: false,
      pricingType: "FIXED" as const,
      basePrice: 3000,
      deliveryTurnaroundDays: 2,
      maxRevisions: 2,
      manualAcceptanceRequired: false,
      validityType: "SHORT_14D" as const,
      validUntil: daysAgo(20),
      archiveExpiresAt: daysFromNow(10),
      deliverablesSummary: ["Edited portfolio DOCX", "Checklist feedback"],
      requirementsConfig: categoriesBySlug["editing-and-proofreading"].requirementsSchema,
      revisionPolicy: "2 revisions included.",
      cancellationPolicy: "Standard escrow terms apply.",
      status: "ARCHIVED" as const,
      publishedAt: daysAgo(34),
    },
  ];

  const listingsBySlug: Record<string, { id: string; slug: string; title: string }> = {};
  for (const l of listingSeeds) {
    const saved = await db.taskListing.upsert({
      where: { slug: l.slug },
      update: {},
      create: l,
    });
    listingsBySlug[saved.slug] = saved;
  }

  // 6. Bookings across lifecycle states
  const expiredListing = listingsBySlug["annual-sustainability-esg-report-edition"];
  const litListing = listingsBySlug["systematic-academic-literature-review-2500-words"];
  const essayListing = listingsBySlug["university-analytical-essay-structure-and-drafting"];
  const articleListing = listingsBySlug["long-form-editorial-article-and-seo-brief"];
  const editListing = listingsBySlug["thesis-and-manuscript-developmental-editing-5000w"];

  // Booking 1: IN_PROGRESS on EXPIRED listing (PRD Rule 2.0 proof!)
  const b1 = await db.booking.upsert({
    where: { bookingRef: "TVL-2026-1001" },
    update: {},
    create: {
      bookingRef: "TVL-2026-1001",
      taskId: expiredListing.id,
      customerId: freeCustomer.id,
      creatorId: creatorProfile1.id,
      taskTitleSnapshot: expiredListing.title,
      currency: "KES",
      listedPrice: 8000,
      extraCharges: 0,
      serviceFee: 800,
      proDiscount: 0,
      totalPayable: 8800,
      creatorNetAmount: 8000,
      requirementsResponses: {
        topic: "East African Agribusiness Carbon Disclosure 2025",
        industry: "Sustainable Agriculture",
        wordCount: 3000,
        instructions:
          "Please highlight smallholder solar cold-chain metrics and align sections to GRI 305.",
      },
      agreedDeliveryDeadline: daysFromNow(3),
      status: "IN_PROGRESS",
      revisionCount: 0,
      maxRevisions: 2,
    },
  });

  await db.paymentTransaction.upsert({
    where: { apiRef: "seed-bk-1001" },
    update: {},
    create: {
      bookingId: b1.id,
      userId: freeCustomer.id,
      purpose: "BOOKING_ESCROW",
      channel: "MPESA_STK",
      apiRef: "seed-bk-1001",
      providerInvoiceId: "INV-SEED-1001",
      phone: "254744500005",
      currency: "KES",
      amount: 8800,
      status: "COMPLETE",
      paidAt: daysAgo(6),
    },
  });

  await db.creatorEarningsLedger.upsert({
    where: { bookingId: b1.id },
    update: {},
    create: {
      creatorId: creatorProfile1.id,
      bookingId: b1.id,
      grossAmount: 8800,
      platformFee: 800,
      netAmount: 8000,
      currency: "KES",
      status: "PENDING_ESCROW",
    },
  });

  // Booking 2: DELIVERED (Pro customer with 50% service fee discount)
  const b2 = await db.booking.upsert({
    where: { bookingRef: "TVL-2026-1002" },
    update: {},
    create: {
      bookingRef: "TVL-2026-1002",
      taskId: litListing.id,
      customerId: proCustomer.id,
      creatorId: creatorProfile1.id,
      taskTitleSnapshot: litListing.title,
      currency: "KES",
      listedPrice: 6500,
      extraCharges: 0,
      serviceFee: 325,
      proDiscount: 325,
      totalPayable: 6825,
      creatorNetAmount: 6500,
      requirementsResponses: {
        topic: "Digital Credit Literacy Among Kenyan Youth MSMEs",
        academicLevel: "Master's",
        wordCount: 2500,
        citationStyle: "APA 7th",
        fileFormat: "DOCX",
        instructions:
          "Focus on empirical studies from 2020-2026 covering M-Shwari, Hustler Fund, and FinTech transparency.",
      },
      agreedDeliveryDeadline: daysFromNow(2),
      status: "DELIVERED",
      deliveredAt: daysAgo(0),
      revisionCount: 0,
      maxRevisions: 2,
    },
  });

  await db.paymentTransaction.upsert({
    where: { apiRef: "seed-bk-1002" },
    update: {},
    create: {
      bookingId: b2.id,
      userId: proCustomer.id,
      purpose: "BOOKING_ESCROW",
      channel: "MPESA_STK",
      apiRef: "seed-bk-1002",
      providerInvoiceId: "INV-SEED-1002",
      phone: "254733400004",
      currency: "KES",
      amount: 6825,
      status: "COMPLETE",
      paidAt: daysAgo(2),
    },
  });

  await db.creatorEarningsLedger.upsert({
    where: { bookingId: b2.id },
    update: {},
    create: {
      creatorId: creatorProfile1.id,
      bookingId: b2.id,
      grossAmount: 6825,
      platformFee: 325,
      netAmount: 6500,
      currency: "KES",
      status: "PENDING_ESCROW",
    },
  });

  // Booking 3: COMPLETED + Reviewed + Available Earnings
  const b3 = await db.booking.upsert({
    where: { bookingRef: "TVL-2026-1003" },
    update: {},
    create: {
      bookingRef: "TVL-2026-1003",
      taskId: essayListing.id,
      customerId: freeCustomer.id,
      creatorId: creatorProfile2.id,
      taskTitleSnapshot: essayListing.title,
      currency: "KES",
      listedPrice: 3200,
      extraCharges: 0,
      serviceFee: 320,
      proDiscount: 0,
      totalPayable: 3520,
      creatorNetAmount: 3200,
      requirementsResponses: {
        topic: "Urban Public Transit Policy Reform in Nairobi",
        wordCount: 1500,
        citationStyle: "Harvard",
        instructions: "Compare BRT corridors and digital fare collection.",
      },
      agreedDeliveryDeadline: daysAgo(3),
      status: "COMPLETED",
      deliveredAt: daysAgo(4),
      completedAt: daysAgo(3),
      revisionCount: 0,
      maxRevisions: 2,
    },
  });

  await db.paymentTransaction.upsert({
    where: { apiRef: "seed-bk-1003" },
    update: {},
    create: {
      bookingId: b3.id,
      userId: freeCustomer.id,
      purpose: "BOOKING_ESCROW",
      channel: "CARD",
      apiRef: "seed-bk-1003",
      providerInvoiceId: "INV-SEED-1003",
      currency: "KES",
      amount: 3520,
      status: "COMPLETE",
      paidAt: daysAgo(6),
    },
  });

  await db.creatorEarningsLedger.upsert({
    where: { bookingId: b3.id },
    update: {},
    create: {
      creatorId: creatorProfile2.id,
      bookingId: b3.id,
      grossAmount: 3520,
      platformFee: 320,
      netAmount: 3200,
      currency: "KES",
      status: "AVAILABLE",
      availableAt: daysAgo(3),
    },
  });

  await db.review.upsert({
    where: { bookingId: b3.id },
    update: {},
    create: {
      bookingId: b3.id,
      taskId: essayListing.id,
      customerId: freeCustomer.id,
      creatorId: creatorProfile2.id,
      rating: 5,
      comment:
        "Clear thesis progression, balanced policy citations, and delivered a full day ahead of deadline.",
    },
  });

  // Booking 4: DISPUTED (for Admin Dispute Tribunal 5.7)
  const b4 = await db.booking.upsert({
    where: { bookingRef: "TVL-2026-1004" },
    update: {},
    create: {
      bookingRef: "TVL-2026-1004",
      taskId: articleListing.id,
      customerId: proCustomer.id,
      creatorId: creatorProfile2.id,
      taskTitleSnapshot: articleListing.title,
      currency: "KES",
      listedPrice: 4000,
      extraCharges: 0,
      serviceFee: 200,
      proDiscount: 200,
      totalPayable: 4200,
      creatorNetAmount: 4000,
      requirementsResponses: {
        topic: "Zero-Knowledge Proofs in Consumer Banking",
        targetAudience: "CTOs & Compliance Officers",
        wordCount: 1800,
        instructions: "Avoid jargon without plain-English analogies.",
      },
      agreedDeliveryDeadline: daysFromNow(1),
      status: "DISPUTED",
      deliveredAt: daysAgo(1),
      revisionCount: 1,
      maxRevisions: 2,
    },
  });

  await db.paymentTransaction.upsert({
    where: { apiRef: "seed-bk-1004" },
    update: {},
    create: {
      bookingId: b4.id,
      userId: proCustomer.id,
      purpose: "BOOKING_ESCROW",
      channel: "MPESA_STK",
      apiRef: "seed-bk-1004",
      providerInvoiceId: "INV-SEED-1004",
      phone: "254733400004",
      currency: "KES",
      amount: 4200,
      status: "COMPLETE",
      paidAt: daysAgo(3),
    },
  });

  await db.creatorEarningsLedger.upsert({
    where: { bookingId: b4.id },
    update: {},
    create: {
      creatorId: creatorProfile2.id,
      bookingId: b4.id,
      grossAmount: 4200,
      platformFee: 200,
      netAmount: 4000,
      currency: "KES",
      status: "PENDING_ESCROW",
    },
  });

  await db.dispute.upsert({
    where: { bookingId: b4.id },
    update: {},
    create: {
      bookingId: b4.id,
      openedById: proCustomer.id,
      reason: "Tone & Technical Depth Mismatch",
      details:
        "The second half omits executive compliance examples requested in the brief; seeking mediated partial split or targeted rewrite.",
      status: "OPEN",
    },
  });

  // Booking 5: PENDING_PAYMENT (so user can test checkout immediately!)
  await db.booking.upsert({
    where: { bookingRef: "TVL-2026-1005" },
    update: {},
    create: {
      bookingRef: "TVL-2026-1005",
      taskId: editListing.id,
      customerId: freeCustomer.id,
      creatorId: creatorProfile1.id,
      taskTitleSnapshot: editListing.title,
      currency: "KES",
      listedPrice: 4800,
      extraCharges: 0,
      serviceFee: 480,
      proDiscount: 0,
      totalPayable: 5280,
      creatorNetAmount: 4800,
      requirementsResponses: {
        topic: "Master's Dissertation Chapter 2 Developmental Edit",
        wordCount: 4400,
        styleGuide: "APA 7th",
        instructions: "Focus on transition coherence and tense consistency.",
      },
      agreedDeliveryDeadline: daysFromNow(2),
      status: "PENDING_PAYMENT",
      revisionCount: 0,
      maxRevisions: 2,
    },
  });

  // Initial BookingMessage seed on b2
  const existingMsgs = await db.bookingMessage.count({ where: { bookingId: b2.id } });
  if (existingMsgs === 0) {
    await db.bookingMessage.createMany({
      data: [
        {
          bookingId: b2.id,
          senderId: proCustomer.id,
          body: "Hi Amara, I attached the syllabus scope in my requirements. Looking forward to the APA synthesis table!",
        },
        {
          bookingId: b2.id,
          senderId: creatorUser.id,
          body: "Received! I have completed the thematic synthesis matrix across 18 sources and uploaded the deliverable draft for your review.",
        },
      ],
    });
  }

  // Initial AuditLog & Notification seed
  const existingLogs = await db.adminAuditLog.count();
  if (existingLogs === 0) {
    await db.adminAuditLog.create({
      data: {
        actorAdminId: adminUser.id,
        action: "PLATFORM_INITIALIZED",
        targetType: "PlatformConfig",
        targetId: "global",
        reason: "Initial v1.0 marketplace configuration and category architecture seeded.",
        metadata: { categoriesCount: categorySeeds.length },
      },
    });
  }

  const existingNotifs = await db.notificationOutbox.count();
  if (existingNotifs === 0) {
    await db.notificationOutbox.createMany({
      data: [
        {
          userId: proCustomer.id,
          channel: "IN_APP",
          eventType: "BOOKING_DELIVERED",
          title: "Deliverable Uploaded: TVL-2026-1002",
          body: "Amara Njoroge delivered your Systematic Academic Literature Review. Review & approve completion or request revisions.",
          linkUrl: "/dashboard/bookings/TVL-2026-1002",
          status: "SENT",
          sentAt: now,
        },
        {
          userId: creatorUser.id,
          channel: "IN_APP",
          eventType: "LISTING_EXPIRING_SOON",
          title: "Booking In Progress on Expired Listing TVL-2026-1001",
          body: "Your listing expired 5 days ago, but active booking TVL-2026-1001 remains protected until delivery deadline.",
          linkUrl: "/creators-hub/bookings/TVL-2026-1001",
          status: "SENT",
          sentAt: now,
        },
      ],
    });
  }

  console.log("Seeded Tovolana Writers PostgreSQL database cleanly.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
