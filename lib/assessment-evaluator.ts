import type { CreatorApplicationStatus } from "@prisma/client";

export interface AssessmentRubricWeights {
  grammar: number;
  coherence: number;
  instruction: number;
  originality: number;
  tone: number;
  research: number;
}

export interface AssessmentEvaluationInput {
  responseText: string;
  promptText: string;
  minWords: number;
  maxWords: number;
  passScoreThreshold: number;
  reviewScoreThreshold: number;
  weights?: Partial<AssessmentRubricWeights>;
}

export interface AssessmentEvaluationResult {
  wordCount: number;
  grammarScore: number;
  coherenceScore: number;
  instructionScore: number;
  originalityScore: number;
  toneScore: number;
  researchScore: number;
  totalScore: number;
  autoDecision: CreatorApplicationStatus;
  feedbackSummary: string;
}

const DISCOURSE_MARKERS = [
  "however",
  "therefore",
  "furthermore",
  "moreover",
  "consequently",
  "additionally",
  "in addition",
  "firstly",
  "secondly",
  "finally",
  "in conclusion",
  "nevertheless",
  "specifically",
  "for instance",
  "for example",
  "meanwhile",
  "similarly",
];

const EVIDENCE_MARKERS = [
  "research",
  "study",
  "studies",
  "evidence",
  "data",
  "according to",
  "analysis",
  "source",
  "sources",
  "peer-reviewed",
  "citation",
  "findings",
  "demonstrates",
  "indicates",
  "report",
];

const STOP_WORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "between",
  "could",
  "should",
  "would",
  "their",
  "there",
  "these",
  "those",
  "through",
  "under",
  "where",
  "which",
  "while",
  "within",
  "write",
  "essay",
  "using",
  "words",
]);

function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function evaluateWritingAssessment(
  input: AssessmentEvaluationInput
): AssessmentEvaluationResult {
  const weights: AssessmentRubricWeights = {
    grammar: input.weights?.grammar ?? 0.25,
    coherence: input.weights?.coherence ?? 0.2,
    instruction: input.weights?.instruction ?? 0.2,
    originality: input.weights?.originality ?? 0.15,
    tone: input.weights?.tone ?? 0.1,
    research: input.weights?.research ?? 0.1,
  };

  const text = input.responseText.trim();
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const lower = text.toLowerCase();

  // 1. Grammar & Mechanics (0-100)
  let grammarScore = 40;
  if (sentences.length >= 4) {
    const capitalizedCount = sentences.filter((s) => /^[A-Z0-9"'(]/.test(s)).length;
    const capRatio = capitalizedCount / sentences.length;
    const avgWordsPerSentence = wordCount / sentences.length;
    const lengthScore =
      avgWordsPerSentence >= 10 && avgWordsPerSentence <= 28
        ? 30
        : avgWordsPerSentence >= 6 && avgWordsPerSentence <= 36
          ? 18
          : 8;
    const hasPunctuationEnd = /[.!?]$/.test(text) ? 10 : 4;
    const doubleSpaceOrRepeats = (text.match(/([a-zA-Z]{2,})\s+\1\b/gi) || [])
      .length;
    grammarScore = clampScore(
      40 + capRatio * 20 + lengthScore + hasPunctuationEnd - doubleSpaceOrRepeats * 6
    );
  } else if (wordCount >= 40) {
    grammarScore = 48;
  } else {
    grammarScore = 25;
  }

  // 2. Coherence & Structure (0-100)
  const discourseHits = DISCOURSE_MARKERS.filter((m) =>
    lower.includes(m)
  ).length;
  const paragraphScore =
    paragraphs.length >= 4
      ? 45
      : paragraphs.length === 3
        ? 38
        : paragraphs.length === 2
          ? 24
          : 10;
  const coherenceScore = clampScore(
    25 + paragraphScore + Math.min(30, discourseHits * 7.5)
  );

  // 3. Instruction Adherence & Word Count (0-100)
  const promptKeywords = Array.from(
    new Set(
      input.promptText
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 5 && !STOP_WORDS.has(w))
    )
  ).slice(0, 12);

  const keywordMatches = promptKeywords.filter((kw) =>
    lower.includes(kw)
  ).length;
  const keywordCoverage =
    promptKeywords.length > 0 ? keywordMatches / Math.min(6, promptKeywords.length) : 0.7;

  let lengthFitScore = 0;
  if (wordCount >= input.minWords && wordCount <= input.maxWords) {
    lengthFitScore = 65;
  } else if (wordCount >= input.minWords * 0.8 && wordCount <= input.maxWords * 1.15) {
    lengthFitScore = 45;
  } else if (wordCount >= input.minWords * 0.5) {
    lengthFitScore = 25;
  } else {
    lengthFitScore = Math.max(5, Math.round((wordCount / Math.max(1, input.minWords)) * 30));
  }
  const instructionScore = clampScore(
    lengthFitScore + Math.min(35, keywordCoverage * 35)
  );

  // 4. Originality & Expression (0-100)
  const normalizedWords = words.map((w) =>
    w.toLowerCase().replace(/[^a-z0-9'-]/g, "")
  ).filter(Boolean);
  const uniqueRatio =
    normalizedWords.length > 0
      ? new Set(normalizedWords).size / normalizedWords.length
      : 0;
  const originalityScore = clampScore(
    wordCount < 60
      ? 30
      : 35 + Math.min(45, uniqueRatio * 95) + (paragraphs.length >= 3 ? 20 : 10)
  );

  // 5. Tone & Formatting (0-100)
  const slangMatches = (
    lower.match(/\b(lol|omg|idk|tbh|u|ur|gonna|wanna|kinda|bruh|pls)\b/g) || []
  ).length;
  const allCapsWords = words.filter(
    (w) => w.length >= 4 && w === w.toUpperCase() && /[A-Z]/.test(w)
  ).length;
  const toneScore = clampScore(
    90 - slangMatches * 10 - allCapsWords * 6 - (wordCount < 80 ? 35 : 0)
  );

  // 6. Research & Citation Accuracy (0-100)
  const evidenceHits = EVIDENCE_MARKERS.filter((m) => lower.includes(m)).length;
  const citationMatches = (
    text.match(/\([A-Z][a-zA-Z]+,\s*\d{4}\)|\[\d+\]|\(\d{4}\)/g) || []
  ).length;
  const researchScore = clampScore(
    30 + Math.min(40, evidenceHits * 8) + Math.min(30, citationMatches * 15)
  );

  const totalScore = clampScore(
    grammarScore * weights.grammar +
      coherenceScore * weights.coherence +
      instructionScore * weights.instruction +
      originalityScore * weights.originality +
      toneScore * weights.tone +
      researchScore * weights.research
  );

  let autoDecision: CreatorApplicationStatus;
  let feedbackSummary: string;

  if (totalScore >= input.passScoreThreshold) {
    autoDecision = "APPROVED";
    feedbackSummary = `Congratulations! Your writing sample scored ${totalScore}/100 across all 6 evaluation criteria (${wordCount} words), unlocking full Creators Hub publishing permissions.`;
  } else if (totalScore >= input.reviewScoreThreshold) {
    autoDecision = "UNDER_REVIEW";
    feedbackSummary = `Your writing sample scored ${totalScore}/100 (${wordCount} words) and has been queued for editorial administrator review.`;
  } else {
    autoDecision = "REJECTED";
    feedbackSummary = `Your writing sample scored ${totalScore}/100 (${wordCount} words), below the ${input.passScoreThreshold}% threshold. Strengthen paragraph transitions, word-count target (${input.minWords}-${input.maxWords} words), and evidence citations before reapplying.`;
  }

  return {
    wordCount,
    grammarScore,
    coherenceScore,
    instructionScore,
    originalityScore,
    toneScore,
    researchScore,
    totalScore,
    autoDecision,
    feedbackSummary,
  };
}

export { countWords };
