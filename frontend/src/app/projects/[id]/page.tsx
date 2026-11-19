import type { Metadata } from "next";
import ProjectDetail from "../../../components/ProjectDetail";
import SiteHeader from "../../../components/SiteHeader";

export const metadata: Metadata = {
  title: "Project details · HANDOVERIQ",
};
export const instant = false;
// In Next.js 16, route params arrive as a promise.
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* key: a different id always starts fresh, never showing the previous project */}
        <ProjectDetail key={id} rawId={id} />
      </main>
    </div>
  );
}