import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={<p className="text-sm text-dim">Loading…</p>}>
        <SignIn />
      </Suspense>
    </div>
  );
}
