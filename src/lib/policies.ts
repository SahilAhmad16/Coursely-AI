export const policies = {
  privacy: {
    title: "Privacy Policy",
    intro: "How Coursely AI collects and uses account, marketplace, and support information.",
    sections: [
      ["Information we collect", "We collect account details, profile information, seller-store and verification information, listings, messages, transaction records, saved addresses, and support requests that are necessary to operate the marketplace."],
      ["How information is used", "Information is used for authentication, marketplace operation, fraud prevention, seller review, customer support, order and service workflows, legal compliance, and product improvement."],
      ["Private information", "Passwords are handled by the authentication provider. Private seller documents and paid digital files use restricted storage. Coursely AI will never ask for passwords, OTPs, or complete card details in chat."],
      ["Service providers", "Coursely AI may use infrastructure, authentication, payment, email, analytics, and security providers. Each provider receives only the information needed for its role."],
      ["Your choices", "Users can update profile information and saved addresses in their account. Formal deletion/export contact details and retention periods will be finalized before production launch."],
    ],
  },
  terms: {
    title: "Terms of Use",
    intro: "Core rules for using Coursely AI as a customer, seller, or affiliate publisher.",
    sections: [
      ["Accounts", "You must provide accurate information, protect your account, and use the platform lawfully. Account access may be limited for fraud, abuse, unpaid seller plans, or policy violations."],
      ["Listings", "Sellers are responsible for accurate titles, descriptions, prices, rights, and disclosures. Prohibited, copied, misleading, unsafe, or unlawful listings may be rejected or removed."],
      ["Seller plans", "Each seller category receives one initial 28-day free period. Current renewal prices are ₹50 for Services, ₹60 for Digital Products, and ₹50 for Product Affiliate sellers per 28 days."],
      ["Platform commission", "Coursely AI records a 10% platform commission only on confirmed Digital Product sales completed through Coursely AI. Professional Services have no per-sale commission. Affiliate purchases happen on the partner site."],
      ["Production terms", "Payment settlement timelines, taxes, formal jurisdiction, and final legal contact details will be completed and reviewed before real-money launch."],
    ],
  },
  refunds: {
    title: "Refund and Cancellation Policy",
    intro: "How cancellation and refund responsibility differs by seller path.",
    sections: [
      ["Digital Products", "Refund eligibility depends on payment status, delivery status, listing accuracy, duplicate charges, and applicable law. A secure refund workflow will be enabled with live payments."],
      ["Professional Services", "Customers and providers should agree on scope, milestones, delivery, and revisions in the service work area. Unresolved problems can be raised through the dispute workflow."],
      ["Affiliate Products", "Coursely AI does not take the payment or fulfil the order. The external partner's cancellation, return, replacement, refund, delivery, and warranty policies apply."],
      ["Seller plans", "Rules for failed renewals, duplicate charges, and plan cancellations will follow the connected payment provider and the final seller agreement before launch."],
    ],
  },
  sellers: {
    title: "Seller Policy",
    intro: "Standards for Digital Product, Professional Service, and Product Affiliate sellers.",
    sections: [
      ["Verification", "A seller application and identity/business review may be required before listings are published. Verification does not guarantee listing approval."],
      ["Digital Products", "Sellers must own or have permission to sell every included file and clearly state formats, access, license rights, and what the buyer receives."],
      ["Professional Services", "Sellers must describe scope, delivery time, included revisions, and requirements accurately and keep important work decisions in the service workspace."],
      ["Product Affiliate offers", "Sellers may use only approved affiliate links and content they are permitted to publish. Every listing must clearly disclose the affiliate relationship."],
      ["Enforcement", "Coursely AI may request changes, reject or remove listings, lock seller tools, preserve audit records, or suspend accounts when necessary for safety or compliance."],
    ],
  },
  affiliate: {
    title: "Affiliate Disclosure",
    intro: "What buyers should know before opening a Product Affiliate offer.",
    sections: [
      ["External purchase", "Affiliate product buttons open an external partner website. Coursely AI does not control its current price, stock, checkout, delivery, tracking, warranty, returns, or refunds."],
      ["Affiliate earnings", "The listing publisher may earn a commission when an eligible purchase is made through the approved link. The partner tracks and pays that earning under its own programme rules."],
      ["No extra buyer charge", "An affiliate commission generally does not add a separate Coursely AI fee to the buyer, but the final price and charges are always those shown by the external partner."],
      ["Reporting", "Users can report misleading, unsafe, expired, or improperly disclosed affiliate listings for admin review."],
    ],
  },
} as const;

export type PolicySlug = keyof typeof policies;
