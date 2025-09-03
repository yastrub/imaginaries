import React, { Suspense } from "react";

// Force dynamic rendering and disable ISR for the admin app.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Template({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
