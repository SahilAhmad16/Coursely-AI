"use client";

import { useEffect } from "react";

export function ClearPaidCart({ enabled }: { enabled: boolean }) {
  useEffect(() => { if (enabled) localStorage.removeItem("coursely-ai-cart"); }, [enabled]);
  return null;
}
