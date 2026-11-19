// These types mirror the backend's response models (backend/app/schemas).

export type ProjectStatus = "active" | "on_hold" | "completed";
export type AccessRole = "owner" | "outgoing" | "incoming" | "collaborator";
export type MemberRole = "outgoing" | "incoming" | "collaborator";
export type HandoverStatus = "draft" | "in_review" | "completed";
export type ProcessingStatus = "processing" | "processed" | "failed";
export type AnalysisStatus = "not_analyzed" | "analyzing" | "analyzed" | "failed";
export type SectionType =
  | "overview"
  | "technical"
  | "completed_tasks"
  | "pending_tasks"
  | "decisions"
  | "dependencies"
  | "known_issues"
  | "setup"
  | "recommendations";
export type KnowledgeCategory =
  | "summary"
  | "technical_requirement"
  | "completed_task"
  | "pending_task"
  | "decision"
  | "dependency"
  | "known_issue"
  | "setup_step"
  | "recommendation";
export type KnowledgeStatus = "suggested" | "accepted" | "edited" | "rejected";
export type Confidence = "high" | "medium" | "low";
export type RunStatus = "running" | "succeeded" | "failed";

export type User = { id: number; email: string; full_name: string; created_at: string };

export type Project = {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  my_role: AccessRole;
  owner: { id: number; full_name: string };
  document_count: number;
  member_count: number;
  handover_status: HandoverStatus | null;
  handover_progress: number;
  created_at: string;
  updated_at: string;
};

export type Member = {
  id: number | null;
  name: string;
  email: string;
  role: AccessRole;
  is_owner: boolean;
  has_account: boolean;
  created_at: string;
};

export type Activity = {
  id: number;
  project_id: number;
  project_name: string | null;
  actor_name: string;
  action: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
};

export type DocumentItem = {
  id: number;
  project_id: number;
  filename: string;
  file_type: "pdf" | "docx" | "txt" | "md";
  size_bytes: number;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  char_count: number;
  page_count: number | null;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
  last_analyzed_at: string | null;
  uploaded_by_name: string | null;
  knowledge_count: number;
  created_at: string;
};

export type DocumentText = {
  id: number;
  filename: string;
  text: string;
  total_chars: number;
  truncated: boolean;
};

export type HandoverSection = {
  section_type: SectionType;
  title: string;
  content: string;
  is_complete: boolean;
  updated_at: string;
};

export type Handover = {
  id: number;
  project_id: number;
  status: HandoverStatus;
  progress: number;
  completed_sections: number;
  total_sections: number;
  sections: HandoverSection[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  completed_by_name: string | null;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
};

export type KnowledgeItem = {
  id: number;
  project_id: number;
  document_id: number | null;
  source_name: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  source_quote: string | null;
  quote_verified: boolean;
  confidence: Confidence;
  status: KnowledgeStatus;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnalysisRun = {
  id: number;
  project_id: number;
  document_id: number | null;
  document_name: string;
  status: RunStatus;
  model: string;
  error_code: string | null;
  error_message: string | null;
  truncated: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  items_created: number;
  started_at: string;
  finished_at: string | null;
};

export type Report = {
  id: number;
  project_id: number;
  version: number;
  title: string;
  created_by_name: string | null;
  created_at: string;
  handover_status: string | null;
  progress: number;
};

export type ReportSnapshot = {
  project: { id: number; name: string; description: string | null; status: string; owner: string };
  handover: {
    status: HandoverStatus;
    progress: number;
    completed_at: string | null;
    completed_by: string | null;
    acknowledged_at: string | null;
    acknowledged_by: string | null;
  };
  outgoing_member: { name: string; email: string } | null;
  incoming_member: { name: string; email: string } | null;
  members: { name: string; email: string; role: string }[];
  sections: { section_type: SectionType; title: string; content: string; is_complete: boolean }[];
  documents: { filename: string; file_type: string }[];
};

export type ReportDetail = Report & { snapshot: ReportSnapshot };

export type Dashboard = {
  stats: {
    total_projects: number;
    active_projects: number;
    completed_handovers: number;
    pending_handovers: number;
  };
  recent_projects: Project[];
  recent_activity: Activity[];
};

export type AnalyzeResult = { run: AnalysisRun; document: DocumentItem };
export type ApplyResult = { applied_count: number; sections_updated: SectionType[] };
export type AIStatus = { configured: boolean; model: string };
