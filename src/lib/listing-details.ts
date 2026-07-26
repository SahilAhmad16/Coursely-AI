export type ListingType = "digital" | "service" | "affiliate";

export type ListingDetails = {
  digitalIncluded?: string;
  digitalFormat?: string;
  digitalLicense?: string;
  serviceScope?: string;
  serviceRevisions?: string;
};

const detailKeys = [
  "digitalIncluded", "digitalFormat", "digitalLicense",
  "serviceScope", "serviceRevisions",
] as const;

export function readListingDetails(value: unknown): ListingDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const details: ListingDetails = {};
  for (const key of detailKeys) {
    const item = (value as Record<string, unknown>)[key];
    if (typeof item === "string") details[key] = item;
  }
  return details;
}
