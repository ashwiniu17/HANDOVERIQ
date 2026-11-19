"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Download, Eye, FilePlus2, FileText } from "lucide-react";
import { useProject } from "@/components/features/ProjectContext";
import { HandoverStatusBadge } from "@/components/features/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { EmptyState, ErrorState, ListSkeleton, Spinner } from "@/components/ui/Feedback";
import { Markdown } from "@/components/ui/Markdown";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useResource } from "@/lib/hooks";
import type { HandoverStatus, Report, ReportDetail } from "@/lib/types";

export default function ReportsPage() {
  const { project, canEdit } = useProject();
  const toast = useToast();
  const reports = useResource(() => api.reports.list(project.id), project.id);

  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<{ report: Report; detail: ReportDetail | null; error: string | null } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const report = await api.reports.create(project.id, title.trim() || undefined);
      toast.success(`Report v${report.version} generated from the current handover.`);
      setTitle("");
      reports.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function open(report: Report) {
    setViewing({ report, detail: null, error: null });
    try {
      setViewing({ report, detail: await api.reports.get(project.id, report.id), error: null });
    } catch (err) {
      setViewing({ report, detail: null, error: errorMessage(err) });
    }
  }

  async function download(report: Report, format: "pdf" | "md") {
    const key = `${report.id}:${format}`;
    setDownloading(key);
    try {
      await api.reports.download(project.id, report.id, format, `report-v${report.version}.${format}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-ink-soft">
        A report is a frozen copy of the handover at one moment. Later edits never change it, so you can always show exactly what was handed over and when.
      </p>

      {canEdit && (
        <form onSubmit={create} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
          <div className="min-w-[14rem] flex-1">
            <Input label="Report title" optional value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={`${project.name} handover report`} />
          </div>
          <Button type="submit" loading={creating} icon={<FilePlus2 className="size-4" aria-hidden />}>Generate report</Button>
        </form>
      )}

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-lg font-bold tracking-tight">Report history</h2>
        <div className="rounded-2xl border border-line bg-surface px-5">
          {reports.error && !reports.data ? (
            <div className="py-5"><ErrorState message={reports.error.message} onRetry={reports.reload} /></div>
          ) : reports.loading && !reports.data ? (
            <ListSkeleton rows={2} />
          ) : reports.data && reports.data.length === 0 ? (
            <EmptyState icon={<FileText className="size-6" aria-hidden />} title="No reports yet">
              {canEdit ? "Generate a report once the handover has something in it. You need to start the handover first." : "No report has been generated for this project yet."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {reports.data?.map((report) => (
                <li key={report.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                  <Badge tone="brand">v{report.version}</Badge>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-[15px] font-semibold">{report.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(report.created_at)}{report.created_by_name ? ` by ${report.created_by_name}` : ""} · {report.progress}% of sections complete</p>
                  </div>
                  {report.handover_status && <HandoverStatusBadge status={report.handover_status as HandoverStatus} />}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => open(report)} icon={<Eye className="size-3.5" aria-hidden />}>View</Button>
                    <Button size="sm" variant="secondary" onClick={() => download(report, "pdf")} loading={downloading === `${report.id}:pdf`} icon={<Download className="size-3.5" aria-hidden />}>PDF</Button>
                    <Button size="sm" variant="ghost" onClick={() => download(report, "md")} loading={downloading === `${report.id}:md`}>Markdown</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.report.title ?? ""}
        description={viewing ? `Version ${viewing.report.version}, generated ${formatDateTime(viewing.report.created_at)}` : undefined}
        size="lg"
        footer={
          <>
            {viewing && <Button variant="secondary" onClick={() => download(viewing.report, "pdf")} icon={<Download className="size-4" aria-hidden />}>Download PDF</Button>}
            <Button onClick={() => setViewing(null)}>Close</Button>
          </>
        }
      >
        {viewing?.error ? (
          <p role="alert" className="text-sm text-danger">{viewing.error}</p>
        ) : !viewing?.detail ? (
          <Spinner label="Loading report…" />
        ) : (
          <div className="space-y-6">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold text-muted">Outgoing member</dt><dd>{viewing.detail.snapshot.outgoing_member?.name ?? "Not assigned"}</dd></div>
              <div><dt className="text-xs font-semibold text-muted">Incoming member</dt><dd>{viewing.detail.snapshot.incoming_member?.name ?? "Not assigned"}</dd></div>
            </dl>
            {viewing.detail.snapshot.sections.map((s) => (
              <section key={s.section_type}>
                <h3 className="mb-1.5 text-base font-bold">{s.title}</h3>
                {s.content ? <Markdown content={s.content} className="font-serif" /> : <p className="text-sm italic text-muted">Nothing recorded.</p>}
              </section>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
