import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={<p className="text-sm text-dim">Loading…</p>}>
        <SignUp />
      </Suspense>
    </div>
  );
}
