import BackendStatus from "../components/BackendStatus";
import ProjectDashboard from "../components/ProjectDashboard";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-400/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
          >
            H
          </span>
          <span className="text-lg font-bold tracking-tight">HANDOVERIQ</span>
        </div>
      </header>

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