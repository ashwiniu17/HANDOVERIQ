import BackendStatus from "../components/BackendStatus";
import ProjectDashboard from "../components/ProjectDashboard";
import SiteHeader from "../components/SiteHeader";

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Project Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-base text-gray-600 dark:text-gray-400">
            Manage your projects and prepare reliable handovers. Keep every
            decision, task and piece of ownership in one place, backed by
            evidence, so the next person can pick up exactly where you left off.
          </p>
        </section>

        <ProjectDashboard />

        <section aria-label="System status" className="max-w-md">
          <BackendStatus />
        </section>
      </main>
    </div>
  );
}