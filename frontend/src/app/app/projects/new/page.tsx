"use client";

import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/features/ProjectForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New project" description="Give it a name now. You will add people and documents next." />
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <ProjectForm
          submitLabel="Create project"
          onCancel={() => router.push("/app/projects")}
          onSubmit={async (values) => {
            const project = await api.projects.create(values);
            toast.success("Project created. Add the people involved, then upload documents.");
            router.push(`/app/projects/${project.id}`);
          }}
        />
      </div>
    </div>
  );
}
