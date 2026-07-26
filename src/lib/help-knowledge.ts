export type HelpAnswer = {
  reply: string;
  suggestions: string[];
  href?: string;
  linkLabel?: string;
};

type HelpArticle = HelpAnswer & {
  keywords: string[];
};

const DEFAULT_SUGGESTIONS = [
  "How do I become a seller?",
  "What are the seller fees?",
  "How do I sell a digital product?",
  "How do I add an affiliate product?",
];

const articles: HelpArticle[] = [
  {
    keywords: ["seller", "sell", "store", "start selling", "become a seller", "seller setup"],
    reply: "To become a seller, create an account and log in. Choose the seller path, complete your store details, and submit verification. After approval, you can create Digital Product, Professional Service, or Product Affiliate listings.",
    suggestions: ["What is required for KYC?", "What are the seller fees?", "How do I upload a listing?"],
    href: "/start",
    linkLabel: "Open seller setup",
  },
  {
    keywords: ["seller fee", "seller fees", "fee", "fees", "subscription", "plan", "price", "charges", "monthly", "28 day", "trial", "free trial", "renewal"],
    reply: "Every seller category includes one initial 28-day trial. After that, Professional Services costs Rs. 50, Digital Products costs Rs. 60, and Product Affiliate costs Rs. 50 per 28 days. If a plan expires, that category's seller tools and listings remain locked until renewal.",
    suggestions: ["When is the 10% commission charged?", "My plan has expired", "How do I become a seller?"],
    href: "/seller-plan",
    linkLabel: "View seller plans",
  },
  {
    keywords: ["commission", "10 percent", "10%", "platform fee", "deduct", "earning", "income"],
    reply: "Coursely AI charges a 10% platform commission only on confirmed Digital Product sales. Professional Services have no per-sale commission. Affiliate Product earnings and settlement follow the external partner's rules, and Coursely AI does not deduct 10% from those sales.",
    suggestions: ["What are the seller fees?", "How do affiliate products work?", "How will digital payments work?"],
  },
  {
    keywords: ["login", "log in", "signin", "sign in", "account", "register", "create account", "google", "gmail"],
    reply: "Select Create Account to register a new account. Existing users can select Log In. Continue with Google lets you sign in or register with a Google account. You must be logged in to use seller tools, the wishlist, checkout, and support tickets.",
    suggestions: ["I forgot my password", "How do I become a seller?", "Google login is not working"],
    href: "/login",
    linkLabel: "Open login page",
  },
  {
    keywords: ["forgot", "forgotten password", "password", "reset", "cannot log in", "email link"],
    reply: "Select Forgot Password on the login page and enter your registered email address. You will receive a secure reset link by email. Never share your password, OTP, or reset link with anyone.",
    suggestions: ["How do I log in?", "Contact support"],
    href: "/forgot-password",
    linkLabel: "Open password reset",
  },
  {
    keywords: ["kyc", "verification", "verify", "document", "identity", "approval", "seller approval"],
    reply: "Seller verification requires your legal name, business type, address, and supported identity or business-document details. Documents are kept in private storage and reviewed by an administrator. Seller approval does not guarantee listing approval because listings are reviewed separately.",
    suggestions: ["How do I become a seller?", "How are listings reviewed?", "Is my private data safe?"],
    href: "/sell",
    linkLabel: "Open seller verification",
  },
  {
    keywords: ["listing", "upload", "add product", "add service", "thumbnail", "cover", "banner", "description", "category"],
    reply: "Choose a listing type from the seller dashboard, then enter the title, category, price, description, and type-specific details. After saving the draft, upload a thumbnail or cover and preview media. Digital Products require a private delivery file, Services require scope, delivery, and revision details, and Products require an approved affiliate link and disclosure.",
    suggestions: ["Digital product requirements", "How do I list a service?", "Affiliate product requirements"],
    href: "/sell",
    linkLabel: "Create a listing",
  },
  {
    keywords: ["how to sell a digital product", "sell digital product", "digital product", "digital", "ebook", "template", "download", "file", "pdf", "zip", "license", "instant delivery"],
    reply: "A Digital Product listing includes a title, description, category, price, cover or thumbnail, previews, file format, version, license, and private delivery file. Buyers receive access only after a paid order is verified. Live automatic delivery will be enabled with the Cashfree payment webhook during the production phase.",
    suggestions: ["When is the 10% commission charged?", "How do I upload a listing?", "How will refunds work?"],
    href: "/marketplace?type=digital",
    linkLabel: "View Digital Products",
  },
  {
    keywords: ["service", "freelancer", "professional", "video editing", "web design", "developer", "revision", "milestone", "deadline", "chat"],
    reply: "A Professional Service seller must clearly list the scope, delivery time, included revisions, and customer requirements. The customer-provider workspace supports chat, files, milestones, delivery submission, revision requests, and disputes. Coursely AI does not charge a per-sale commission on Services.",
    suggestions: ["What is the Service seller fee?", "How does customer chat work?", "How do I raise a dispute?"],
    href: "/marketplace?type=service",
    linkLabel: "View Professional Services",
  },
  {
    keywords: ["affiliate", "amazon", "flipkart", "external", "partner", "product link", "product section", "delivery tracking"],
    reply: "The Products section is affiliate-only. Sellers add an approved partner link, permitted images and details, the current partner price, and a clear affiliate disclosure. Buyers complete checkout on the partner website, which handles payment, stock, delivery, tracking, returns, warranty, and affiliate payouts.",
    suggestions: ["What is the Affiliate seller fee?", "How do I add an affiliate link?", "Where are product returns handled?"],
    href: "/marketplace?type=affiliate",
    linkLabel: "View Products",
  },
  {
    keywords: ["payment", "cashfree", "upi", "card", "netbanking", "checkout", "pay", "transaction", "success", "failed"],
    reply: "Real payments are not enabled on the local website yet. Cashfree checkout for UPI, cards, and net banking, together with signed webhooks, will be connected during the production phase. An order or seller renewal will be marked as paid only after the server verifies Cashfree's confirmation.",
    suggestions: ["When will I receive a digital download?", "How will refunds work?", "How will seller renewal work?"],
  },
  {
    keywords: ["order", "history", "invoice", "refund", "return", "cancel", "cancellation"],
    reply: "Coursely AI Digital Product and Service orders will appear in the Order History section after live checkout is enabled. Refund and invoice flows will be enabled with the Cashfree production integration. Affiliate Product orders, invoices, returns, and refunds are handled by the external partner.",
    suggestions: ["How will payments work?", "Where are affiliate returns handled?", "Create a support ticket"],
    href: "/account",
    linkLabel: "Open My Account",
  },
  {
    keywords: ["support", "help", "contact", "ticket", "complaint", "problem", "issue", "bug"],
    reply: "The Help Centre includes frequently asked questions. After logging in, you can create a private support ticket and view the administrator's response there. Never include passwords, OTPs, card details, API keys, or complete identity-document numbers in a ticket.",
    suggestions: ["How do I log in?", "How do I raise a dispute?", "View policies"],
    href: "/support",
    linkLabel: "Open Help Centre",
  },
  {
    keywords: ["safe", "security", "privacy", "data", "otp", "card", "document safe", "scam"],
    reply: "Passwords are handled by the authentication provider. Seller KYC documents and paid digital files are stored privately. Coursely AI will never ask for passwords, OTPs, full card details, API keys, or complete identity numbers in chat or support.",
    suggestions: ["Privacy policy", "Create a support ticket", "What is Seller KYC?"],
    href: "/policies/privacy",
    linkLabel: "Read the Privacy Policy",
  },
];

const stopWords = new Set(["a", "an", "the", "and", "or", "for", "to", "is", "are", "of", "in", "on", "my", "your", "how", "what"]);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("₹", " rs ")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value).split(" ").filter((token) => token.length > 1 && !stopWords.has(token));
}

export function answerHelpQuestion(question: string): HelpAnswer {
  const normalizedQuestion = normalize(question);
  const questionTokens = new Set(tokens(question));
  let best: { article: HelpArticle; score: number } | null = null;

  for (const article of articles) {
    let score = 0;
    const articleTokens = new Set<string>();
    for (const keyword of article.keywords) {
      const normalizedKeyword = normalize(keyword);
      if (normalizedQuestion === normalizedKeyword) score += 20;
      else if (normalizedQuestion.includes(normalizedKeyword)) score += normalizedKeyword.includes(" ") ? 8 : 3;
      for (const token of tokens(keyword)) articleTokens.add(token);
    }
    for (const token of articleTokens) if (questionTokens.has(token)) score += 2;
    if (!best || score > best.score) best = { article, score };
  }

  if (best && best.score >= 3) {
    return {
      reply: best.article.reply,
      suggestions: best.article.suggestions,
      href: best.article.href,
      linkLabel: best.article.linkLabel,
    };
  }

  return {
    reply: "I can help with Coursely AI accounts, seller plans, Digital Products, Professional Services, affiliate Products, listings, payments, and support. Please make your question more specific, or create a support ticket for private help.",
    suggestions: DEFAULT_SUGGESTIONS,
    href: "/support",
    linkLabel: "Open Help Centre",
  };
}

export function initialHelpSuggestions() {
  return DEFAULT_SUGGESTIONS;
}
