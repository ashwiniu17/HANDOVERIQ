"""Vocabulary shared by models, schemas and services."""
from __future__ import annotations

from enum import Enum


class ProjectStatus(str, Enum):
    active = "active"
    on_hold = "on_hold"
    completed = "completed"


class MemberRole(str, Enum):
    outgoing = "outgoing"
    incoming = "incoming"
    collaborator = "collaborator"


class AccessRole(str, Enum):
    """A person's role in one project. "owner" is the account that created it."""

    owner = "owner"
    outgoing = "outgoing"
    incoming = "incoming"
    collaborator = "collaborator"


class Permission(str, Enum):
    view = "view"
    edit = "edit"
    manage = "manage"


ROLE_PERMISSIONS: dict[AccessRole, set[Permission]] = {
    AccessRole.owner: {Permission.view, Permission.edit, Permission.manage},
    AccessRole.outgoing: {Permission.view, Permission.edit},
    AccessRole.collaborator: {Permission.view, Permission.edit},
    AccessRole.incoming: {Permission.view},
}


class ProcessingStatus(str, Enum):
    processing = "processing"
    processed = "processed"
    failed = "failed"


class AnalysisStatus(str, Enum):
    not_analyzed = "not_analyzed"
    analyzing = "analyzing"
    analyzed = "analyzed"
    failed = "failed"


class HandoverStatus(str, Enum):
    draft = "draft"
    in_review = "in_review"
    completed = "completed"


class SectionType(str, Enum):
    overview = "overview"
    technical = "technical"
    completed_tasks = "completed_tasks"
    pending_tasks = "pending_tasks"
    decisions = "decisions"
    dependencies = "dependencies"
    known_issues = "known_issues"
    setup = "setup"
    recommendations = "recommendations"


# Order and titles used everywhere a handover is listed or printed.
SECTION_TITLES: dict[SectionType, str] = {
    SectionType.overview: "Project overview",
    SectionType.technical: "Technical documentation",
    SectionType.completed_tasks: "Completed tasks",
    SectionType.pending_tasks: "Pending tasks",
    SectionType.decisions: "Important decisions",
    SectionType.dependencies: "Dependencies",
    SectionType.known_issues: "Known issues",
    SectionType.setup: "Setup instructions",
    SectionType.recommendations: "Future recommendations",
}


class KnowledgeCategory(str, Enum):
    summary = "summary"
    technical_requirement = "technical_requirement"
    completed_task = "completed_task"
    pending_task = "pending_task"
    decision = "decision"
    dependency = "dependency"
    known_issue = "known_issue"
    setup_step = "setup_step"
    recommendation = "recommendation"


CATEGORY_TO_SECTION: dict[KnowledgeCategory, SectionType] = {
    KnowledgeCategory.summary: SectionType.overview,
    KnowledgeCategory.technical_requirement: SectionType.technical,
    KnowledgeCategory.completed_task: SectionType.completed_tasks,
    KnowledgeCategory.pending_task: SectionType.pending_tasks,
    KnowledgeCategory.decision: SectionType.decisions,
    KnowledgeCategory.dependency: SectionType.dependencies,
    KnowledgeCategory.known_issue: SectionType.known_issues,
    KnowledgeCategory.setup_step: SectionType.setup,
    KnowledgeCategory.recommendation: SectionType.recommendations,
}


class KnowledgeStatus(str, Enum):
    suggested = "suggested"
    accepted = "accepted"
    edited = "edited"
    rejected = "rejected"


class Confidence(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class RunStatus(str, Enum):
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


def values(enum_cls: type[Enum]) -> str:
    """SQL list of an enum's values, for CHECK constraints: 'a', 'b', 'c'."""
    return ", ".join(f"'{member.value}'" for member in enum_cls)
