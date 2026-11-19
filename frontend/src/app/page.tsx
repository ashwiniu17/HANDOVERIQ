import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { EvidenceExample } from "@/components/landing/EvidenceExample";
import { LandingHeader } from "@/components/landing/LandingHeader";

const STEPS = [
  { title: "Create a project and add the people", text: "Name the project, then add who is leaving and who is taking over. Each gets the access their role needs, and nobody else sees anything." },
  { title: "Upload what the project knows", text: "PDF, Word, text and Markdown files: specs, notes, runbooks, meeting minutes. Each file is checked, stored and read." },
  { title: "Let the AI read and propose", text: "For each document the AI lists findings: technical details, decisions, pending work, known issues, setup steps. Every finding carries a quote from the document." },
  { title: "Review every finding", text: "Accept what is right, correct what is close, reject what is wrong. Quotes the AI could not find in the document are flagged before you trust them." },
  { title: "Complete, confirm, export", text: "Fill the nine handover sections, mark them complete and finish. The incoming member acknowledges receipt, and you can export a PDF report." },
];

const FEATURES = [
  { title: "Evidence on every finding", text: "Each AI finding is shown beside the passage it came from. HandoverIQ checks that the passage really appears in your document, and tells you when it does not." },
  { title: "A handover with a shape", text: "Nine sections cover the project overview, technical documentation, completed and pending tasks, decisions, dependencies, known issues, setup and recommendations, with progress you can see." },
  { title: "Roles that match the situation", text: "Outgoing, incoming and collaborating members, plus the project owner. The incoming member reads and acknowledges; they cannot change what was handed over." },
  { title: "You stay in charge", text: "Nothing the AI suggests reaches the handover until a person accepts it. Edit the wording first if it is not quite right." },
  { title: "Reports that never change", text: "Generate a report and it becomes a frozen version. Download it as a PDF or Markdown file, and compare versions in the history." },
  { title: "Private by default", text: "Projects are visible only to their owner and the people added to them. Passwords are hashed, sessions are protected, and uploads are validated." },
];

const BENEFITS = [
  { who: "If you are leaving", text: "You do not start from a blank page. The AI drafts from the documents you already have, and you spend your time correcting and adding, not typing." },
  { who: "If you are taking over", text: "You can see what is pending, what is broken and how to get set up, and you can check any claim against the original words." },
  { who: "If you run the team", text: "A completed, acknowledged and exported handover is a record. The next departure starts from a known process, not a scramble." },
];

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main id="main">
        <section className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pt-20">
          <div>
            <h1 className="text-[2.5rem] font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              The person taking over should not have to take your word for it.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              HandoverIQ turns your project documents into a handover where every claim points back to the passage it came from. The incoming member can check each one.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/register" size="lg">Create an account</ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">Sign in</ButtonLink>
            </div>
            <p className="mt-4 text-sm text-muted">Reads PDF, Word, text and Markdown files.</p>
          </div>
          <EvidenceExample />
        </section>

        <section aria-labelledby="problem" className="border-y border-line bg-surface">
          <div className="mx-auto grid grid-cols-1 max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2">
            <div>
              <h2 id="problem" className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">When someone leaves, the knowledge usually leaves first.</h2>
              <p className="mt-5 text-base leading-relaxed text-ink-soft">
                What a project knows is scattered across notes, tickets, wikis and one person&apos;s memory. A handover meeting captures a fraction of it, and the newcomer cannot tell which parts are solid.
              </p>
              <ul className="mt-6 space-y-3 text-[15px] text-ink-soft">
                <li className="border-l-2 border-line-strong pl-4">Critical details live in a document nobody remembers writing.</li>
                <li className="border-l-2 border-line-strong pl-4">Writing everything down by hand is slow, so it is done late or not at all.</li>
                <li className="border-l-2 border-line-strong pl-4">An AI summary alone is hard to trust: you cannot tell what it made up.</li>
              </ul>
            </div>
            <div className="lg:pt-16">
              <h3 className="text-2xl font-bold tracking-tight">HandoverIQ writes the first draft and shows its sources.</h3>
              <p className="mt-4 text-base leading-relaxed text-ink-soft">
                The AI reads your documents and proposes findings, each with a quote. A person reviews them, and only what they accept goes into the handover. If the AI cites words that are not in the document, you are told.
              </p>
              <p className="mt-4 text-base leading-relaxed text-ink-soft">
                The result is a handover that is faster to write than a blank page and easier to trust than a summary.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 id="how" className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">How a handover goes</h2>
          <ol className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-2">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-5">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{index + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" aria-labelledby="features-heading" className="border-y border-line bg-surface">
          <div className="mx-auto grid grid-cols-1 max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div>
              <h2 id="features-heading" className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:sticky lg:top-24">What is in it</h2>
            </div>
            <dl className="divide-y divide-line">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="py-5 first:pt-0 last:pb-0">
                  <dt className="text-lg font-semibold">{feature.title}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{feature.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="why" aria-labelledby="why-heading" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 id="why-heading" className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Why it helps, whichever side you are on</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <div key={benefit.who} className="border-t-2 border-ink pt-4">
                <h3 className="text-lg font-bold">{benefit.who}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{benefit.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-2xl text-sm text-muted">
            Good to know: HandoverIQ reads text. Scanned pages and images need OCR, which is not supported yet, and a very long document is analyzed from its beginning.
          </p>
        </section>

        <section aria-labelledby="cta" className="bg-ink">
          <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
            <h2 id="cta" className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              Start the handover while the person who knows is still here.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/70">Create an account, add a project and upload your first document. It takes a few minutes.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/register" size="lg" className="!bg-mark !text-ink hover:!bg-mark-soft">Create an account</ButtonLink>
              <ButtonLink href="/login" size="lg" variant="ghost" className="!text-white hover:!bg-white/10">Sign in</ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:px-8">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="#how-it-works" className="hover:text-ink">How it works</Link>
            <Link href="#features" className="hover:text-ink">Features</Link>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
            <Link href="/register" className="hover:text-ink">Create an account</Link>
          </nav>
          <p>© 2026 Ashwini U. Released under the MIT License.</p>
        </div>
      </footer>
    </>
  );
}
