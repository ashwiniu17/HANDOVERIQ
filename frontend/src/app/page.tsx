import BackendStatus from "../components/BackendStatus";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">HANDOVERIQ</h1>
        <p className="mt-2 text-lg text-gray-500">
          AI-powered project handover with evidence-backed knowledge transfer.
        </p>
      </div>
      <BackendStatus />
    </main>
  );
}