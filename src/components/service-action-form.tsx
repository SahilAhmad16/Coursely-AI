"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import type { ServiceActionResult } from "@/app/actions/service-projects";

type ServiceAction = (state: ServiceActionResult, formData: FormData) => Promise<ServiceActionResult>;

export function ServiceActionForm({ action, children, className }: { action: ServiceAction; children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction} className={className}>{children}{state.error && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{state.error}</p>}{state.success && <p className="mt-3 text-sm font-medium text-emerald-700" role="status">{state.success}</p>}</form>;
}

export function ServiceSubmitButton({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={className}>{pending ? "Saving..." : children}</button>;
}
