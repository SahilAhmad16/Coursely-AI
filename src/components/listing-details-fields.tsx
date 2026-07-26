import type { ListingDetails, ListingType } from "@/lib/listing-details";

export function ListingDetailsFields({ listingType, details = {} }: { listingType: ListingType; details?: ListingDetails }) {
  if (listingType === "digital") return <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5"><h2 className="font-black text-violet-950">Digital product details</h2><p className="mt-1 text-sm text-violet-900/70">Tell the buyer exactly what will be delivered after payment.</p><div className="mt-4 grid gap-4"><TextArea label="What is included?" name="digitalIncluded" defaultValue={details.digitalIncluded} placeholder="Example: 25 Canva templates, PDF guide and a bonus checklist" required /><div className="grid gap-4 sm:grid-cols-2"><Field label="File format" name="digitalFormat" defaultValue={details.digitalFormat} placeholder="PDF, ZIP, Canva link…" required /><Field label="License / usage rights" name="digitalLicense" defaultValue={details.digitalLicense} placeholder="Personal use only" required /></div></div></section>;
  if (listingType === "service") return <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5"><h2 className="font-black text-sky-950">Service details</h2><p className="mt-1 text-sm text-sky-900/70">Set clear deliverables, revisions and timeline before a customer contacts you.</p><div className="mt-4 grid gap-4"><TextArea label="Scope and deliverables" name="serviceScope" defaultValue={details.serviceScope} placeholder="Example: One 60-second edited reel, colour correction, captions and music" required /><Field label="Included revisions" name="serviceRevisions" type="number" min="0" max="20" defaultValue={details.serviceRevisions} placeholder="2" required /></div></section>;
  return null;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block text-sm font-bold">{label}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" {...props} /></label>;
}

function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="block text-sm font-bold">{label}<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" {...props} /></label>;
}
