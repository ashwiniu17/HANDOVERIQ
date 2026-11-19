import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, PauseCircle, Eye, FilePen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  ANALYSIS_LABEL, HANDOVER_STATUS_LABEL, KNOWLEDGE_STATUS_LABEL, PROCESSING_LABEL, PROJECT_STATUS_LABEL, ROLE_LABEL,
} from "@/lib/format";
import type { AccessRole, AnalysisStatus, HandoverStatus, KnowledgeStatus, ProcessingStatus, ProjectStatus } from "@/lib/types";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const tone = status === "active" ? "brand" : status === "completed" ? "success" : "warning";
  const icon = status === "completed" ? <CheckCircle2 className="size-3" aria-hidden /> : status === "on_hold" ? <PauseCircle className="size-3" aria-hidden /> : undefined;
  return <Badge tone={tone} icon={icon}>{PROJECT_STATUS_LABEL[status]}</Badge>;
}

export function HandoverStatusBadge({ status }: { status: HandoverStatus | null }) {
  if (status === null) return <Badge icon={<CircleDashed className="size-3" aria-hidden />}>Not started</Badge>;
  if (status === "completed") return <Badge tone="success" icon={<CheckCircle2 className="size-3" aria-hidden />}>{HANDOVER_STATUS_LABEL[status]}</Badge>;
  if (status === "in_review") return <Badge tone="warning" icon={<Eye className="size-3" aria-hidden />}>{HANDOVER_STATUS_LABEL[status]}</Badge>;
  return <Badge tone="brand" icon={<FilePen className="size-3" aria-hidden />}>{HANDOVER_STATUS_LABEL[status]}</Badge>;
}

export function RoleBadge({ role }: { role: AccessRole }) {
  return <Badge tone={role === "owner" ? "brand" : "neutral"}>{ROLE_LABEL[role]}</Badge>;
}

export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  if (status === "failed") return <Badge tone="danger" icon={<AlertTriangle className="size-3" aria-hidden />}>{PROCESSING_LABEL[status]}</Badge>;
  if (status === "processing") return <Badge icon={<Loader2 className="size-3 animate-spin" aria-hidden />}>{PROCESSING_LABEL[status]}</Badge>;
  return <Badge tone="success" icon={<CheckCircle2 className="size-3" aria-hidden />}>{PROCESSING_LABEL[status]}</Badge>;
}

export function AnalysisBadge({ status }: { status: AnalysisStatus }) {
  if (status === "analyzed") return <Badge tone="brand" icon={<CheckCircle2 className="size-3" aria-hidden />}>{ANALYSIS_LABEL[status]}</Badge>;
  if (status === "failed") return <Badge tone="danger" icon={<AlertTriangle className="size-3" aria-hidden />}>{ANALYSIS_LABEL[status]}</Badge>;
  if (status === "analyzing") return <Badge tone="warning" icon={<Loader2 className="size-3 animate-spin" aria-hidden />}>{ANALYSIS_LABEL[status]}</Badge>;
  return <Badge>{ANALYSIS_LABEL[status]}</Badge>;
}

export function KnowledgeStatusBadge({ status }: { status: KnowledgeStatus }) {
  const tone = status === "accepted" ? "success" : status === "edited" ? "brand" : status === "rejected" ? "danger" : "neutral";
  return <Badge tone={tone}>{KNOWLEDGE_STATUS_LABEL[status]}</Badge>;
}
