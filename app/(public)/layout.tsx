import { getCurrentUser } from "@/lib/auth";
import { PublicHeader } from "@/components/site/public-header";
import { PublicFooter } from "@/components/site/public-footer";
import { DemoRibbon } from "@/components/ui/primitives";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <DemoRibbon />
      <PublicHeader signedIn={!!user} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
