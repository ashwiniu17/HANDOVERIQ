"use client";

import { createContext, useContext } from "react";
import type { Project } from "@/lib/types";

type ProjectContextValue = {
  project: Project;
  reload: () => void;
  /** May edit documents, the handover and the project's details. */
  canEdit: boolean;
  /** May manage members and delete the project (the owner). */
  canManage: boolean;
};

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProject must be used inside a project page.");
  return context;
}
