import type { Metadata } from "next";
import LiveDashboard from "@/components/LiveDashboard";

export const metadata: Metadata = { title: "Live · ISS Flyover" };

// Signed-in only (src/proxy.ts). Everything live happens in the browser:
// the initial load and the Realtime subscription both use the user's Clerk token.
export default function LivePage() {
  return <LiveDashboard />;
}
