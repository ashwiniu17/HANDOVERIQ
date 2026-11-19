import { formatDate } from "./format";
import type { Handover, KnowledgeItem, Member } from "./types";

/** The checklist on a project's overview page, worked out from the project's real data. */
export type Step = { title: string; detail: string; done: boolean; href: string; cta: string };

export function buildSteps(args: {
  base: string;
  members: Member[];
  documentCount: number;
  knowledge: KnowledgeItem[];
  aiConfigured: boolean;
  handover: Handover | null;
}): Step[] {
  const { base, members, documentCount, knowledge, aiConfigured, handover } = args;
  const hasOutgoing = members.some((m) => m.role === "outgoing");
  const hasIncoming = members.some((m) => m.role === "incoming");
  const reviewed = knowledge.filter((k) => k.status !== "suggested").length;
  const waiting = knowledge.filter((k) => k.status === "suggested").length;

  return [
    {
      title: "Add the outgoing and incoming members",
      detail: hasOutgoing && hasIncoming ? "Both people are on the project." : `Still needed: ${[!hasOutgoing && "an outgoing member", !hasIncoming && "an incoming member"].filter(Boolean).join(" and ")}.`,
      done: hasOutgoing && hasIncoming,
      href: `${base}/members`,
      cta: "Manage members",
    },
    {
      title: "Upload the project's documents",
      detail: documentCount > 0 ? `${documentCount} document${documentCount === 1 ? "" : "s"} uploaded.` : "PDF, Word, text or Markdown files with what the project knows.",
      done: documentCount > 0,
      href: `${base}/documents`,
      cta: "Open documents",
    },
    {
      title: "Review what the AI found",
      detail: !aiConfigured
        ? "AI analysis is not set up on this server yet. You can still write the handover by hand."
        : knowledge.length === 0
          ? "Analyze a document to get suggestions, each tied to a quote."
          : waiting > 0
            ? `${waiting} item${waiting === 1 ? "" : "s"} waiting for your decision.`
            : `${reviewed} item${reviewed === 1 ? "" : "s"} reviewed.`,
      done: reviewed > 0 && waiting === 0,
      href: `${base}/knowledge`,
      cta: "Open AI review",
    },
    {
      title: "Complete the handover",
      detail: handover ? `${handover.completed_sections} of ${handover.total_sections} sections complete.` : "Start the handover and fill in its nine sections.",
      done: handover?.status === "completed",
      href: `${base}/handover`,
      cta: "Open handover",
    },
    {
      title: "The incoming member confirms receipt",
      detail: handover?.acknowledged_at ? `Acknowledged on ${formatDate(handover.acknowledged_at)}.` : "Once completed, the incoming member acknowledges it.",
      done: Boolean(handover?.acknowledged_at),
      href: `${base}/handover`,
      cta: "View",
    },
  ];
}
