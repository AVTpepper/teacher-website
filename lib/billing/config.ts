export type BillingPlanId = "free" | "plus";

export interface PricingPlanConfig {
  id: BillingPlanId;
  name: string;
  tagline: string;
  priceLabel?: string;
  description: string;
  featureBullets: string[];
  ctaLabel: string;
}

export interface PricingDifferenceItem {
  title: string;
  free: string;
  plus: string;
  note?: string;
}

export interface PricingFaqItem {
  question: string;
  answer: string;
}

export const FREE_MONTHLY_CONNECTION_REQUEST_LIMIT = 5;
export const FREE_MONTHLY_MESSAGE_LIMIT = 10;

export const PRICING_PLANS: PricingPlanConfig[] = [
  {
    id: "free",
    name: "VistaTeacher Free",
    tagline: "Start with the core educator experience.",
    priceLabel: "Free",
    description:
      "Create your profile, explore the network, and make a limited number of new connections each month.",
    featureBullets: [
      "Create your educator profile",
      "Browse educators, resources, and the forum",
      `${FREE_MONTHLY_CONNECTION_REQUEST_LIMIT} connection requests per month`,
      `${FREE_MONTHLY_MESSAGE_LIMIT} messages per month`,
    ],
    ctaLabel: "Create account",
  },
  {
    id: "plus",
    name: "VistaTeacher Plus",
    tagline: "For educators actively building their network.",
    description:
      "Unlock unlimited outreach, stronger discovery, premium profile presentation, and broader AI usage.",
    featureBullets: [
      "Unlimited connection requests",
      "Unlimited messaging",
      "Expanded recommendations",
      "Premium profile and AI access",
    ],
    ctaLabel: "Start with Plus account",
  },
];

export const PRICING_DIFFERENCES: PricingDifferenceItem[] = [
  {
    title: "Outgoing connection requests",
    free: `${FREE_MONTHLY_CONNECTION_REQUEST_LIMIT}/month`,
    plus: "Unlimited",
  },
  {
    title: "Sent messages",
    free: `${FREE_MONTHLY_MESSAGE_LIMIT}/month`,
    plus: "Unlimited",
  },
  {
    title: "Discovery recommendations",
    free: "Basic",
    plus: "Expanded",
  },
  {
    title: "Premium profile presentation",
    free: "Not included",
    plus: "Included",
  },
  {
    title: "AI lesson generations",
    free: "Limited daily usage",
    plus: "Unlimited",
    note: "Plus removes the daily cap for lesson generation requests.",
  },
  {
    title: "AI lesson refinements",
    free: "Limited monthly usage",
    plus: "Unlimited",
    note: "Plus removes the monthly cap for lesson refinement requests.",
  },
];

export const PRICING_FAQ: PricingFaqItem[] = [
  {
    question: "Can I use VistaTeacher for free?",
    answer:
      "Yes. VistaTeacher Free lets you create a professional profile, browse educators, follow educators, use the forum, and use the core content and lesson-building tools.",
  },
  {
    question: "What happens when I reach my connection-request limit?",
    answer:
      "Free accounts can send five outgoing connection requests per calendar month. Incoming requests are still unlimited, and accepted connections remain available.",
  },
  {
    question: "What happens when I reach my message limit?",
    answer:
      "Free accounts can send ten messages per calendar month. Reading existing conversations and receiving new messages stay available.",
  },
  {
    question: "Are there AI limits on the lesson builder?",
    answer:
      "Yes. Free accounts have capped AI lesson generation and lesson refinement usage. Plus removes those core AI usage caps.",
  },
  {
    question: "Can I manage my subscription?",
    answer:
      "Yes. Plus members can use the Stripe billing portal to update payment details, review invoices, and manage the subscription.",
  },
  {
    question: "What happens if I cancel?",
    answer:
      "If you cancel at period end, Plus access continues until the paid period ends. After that, the account falls back to Free limits without removing your profile, connections, or message history.",
  },
  {
    question: "Are existing connections removed if I downgrade?",
    answer: "No. Existing connections and readable conversations remain intact.",
  },
];

export const BILLING_COPY = {
  secureBilling: "Secure billing is handled by Stripe.",
  taxNote: "Taxes may apply depending on your location and Stripe settings.",
};