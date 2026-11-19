"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Download, Eye, FileText, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { useProject } from "@/components/features/ProjectContext";
import { AnalysisBadge, ProcessingBadge } from "@/components/features/StatusBadges";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState, ErrorState, ListSkeleton, Notice, Spinner } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { api, errorMessage } from "@/lib/api";
import { ACCEPTED_EXTENSIONS as ACCEPTED, MAX_UPLOAD_MB as MAX_MB, checkFile } from "@/lib/files";
import { formatBytes, formatDateTime } from "@/lib/format";
import { useResource } from "@/lib/hooks";
import type { DocumentItem, DocumentText } from "@/lib/types";

type UploadRow = { key: number; name: string; state: "uploading" | "done" | "error"; message?: string };

export default function DocumentsPage() {
  const { project, canEdit, reload: reloadProject } = useProject();
  const toast = useToast();
  const docs = useResource(() => api.documents.list(project.id), project.id);
  const ai = useResource(() => api.knowledge.status(), "ai");

  const inputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [preview, setPreview] = useState<{ doc: DocumentItem; text: DocumentText | null; error: string | null } | null>(null);

  const aiReady = ai.data?.configured === true;

  async function uploadFiles(files: File[]) {
    for (const file of files) {
      const key = nextKey.current++;
      const problem = checkFile(file);
      if (problem) {
        setUploads((rows) => [...rows, { key, name: file.name, state: "error", message: problem }]);
        continue;
      }
      setUploads((rows) => [...rows, { key, name: file.name, state: "uploading" }]);
      try {
        const doc = await api.documents.upload(project.id, file);
        setUploads((rows) => rows.map((r) => (r.key === key ? { ...r, state: "done" } : r)));
        if (doc.processing_status === "failed") toast.error(`${file.name} was saved, but its text could not be read: ${doc.processing_error}`);
        docs.reload();
        reloadProject();
      } catch (err) {
        setUploads((rows) => rows.map((r) => (r.key === key ? { ...r, state: "error", message: errorMessage(err) } : r)));
      }
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (canEdit) void uploadFiles(Array.from(event.dataTransfer.files));
  }

  async function analyze(doc: DocumentItem) {
    setAnalyzingId(doc.id);
    try {
      const result = await api.documents.analyze(project.id, doc.id);
      const found = result.run.items_created;
      toast.success(found === 0 ? `${doc.filename} was analyzed, but nothing new was found.` : `Found ${found} item${found === 1 ? "" : "s"} to review in ${doc.filename}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAnalyzingId(null);
      docs.reload();
    }
  }

  async function openPreview(doc: DocumentItem) {
    setPreview({ doc, text: null, error: null });
    try {
      const text = await api.documents.text(project.id, doc.id);
      setPreview({ doc, text, error: null });
    } catch (err) {
      setPreview({ doc, text: null, error: errorMessage(err) });
    }
  }

  async function download(doc: DocumentItem) {
    try {
      await api.documents.download(project.id, doc.id, doc.filename);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.documents.remove(project.id, deleting.id);
      toast.success(`${deleting.filename} was deleted.`);
      setDeleting(null);
      docs.reload();
      reloadProject();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {ai.data && !ai.data.configured && (
        <Notice tone="warning" title="AI analysis is not set up on this server">
          Documents can be uploaded and read, but they cannot be analyzed until the server has an <code className="font-mono text-[13px]">ANTHROPIC_API_KEY</code>. The project owner or whoever runs the server can add it in the backend settings.
        </Notice>
      )}

      {canEdit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragging ? "border-brand bg-brand-soft" : "border-line-strong bg-surface"
          )}
        >
          <UploadCloud className="mx-auto size-8 text-brand" aria-hidden />
          <p className="mt-2 text-[15px] font-semibold">Drop files here, or choose them</p>
          <p className="mt-0.5 text-sm text-ink-soft">PDF, Word (.docx), text and Markdown, up to {MAX_MB} MB each.</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED.join(",")}
            className="sr-only"
            id="file-input"
            onChange={(e) => {
              void uploadFiles(Array.from(e.target.files ?? []));
              e.target.value = ""; // allow choosing the same file again
            }}
          />
          <Button className="mt-4" onClick={() => inputRef.current?.click()} icon={<UploadCloud className="size-4" aria-hidden />}>Choose files</Button>
        </div>
      )}

      {uploads.length > 0 && (
        <ul aria-label="Uploads" className="space-y-1.5 text-sm">
          {uploads.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              {row.state === "uploading" && <Spinner label={`Uploading ${row.name}…`} />}
              {row.state === "done" && <span className="text-success">Uploaded {row.name}</span>}
              {row.state === "error" && <span role="alert" className="text-danger">{row.name}: {row.message}</span>}
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="doc-list">
        <h2 id="doc-list" className="mb-3 text-lg font-bold tracking-tight">Project documents</h2>
        <div className="rounded-2xl border border-line bg-surface px-5">
          {docs.error && !docs.data ? (
            <div className="py-5"><ErrorState message={docs.error.message} onRetry={docs.reload} /></div>
          ) : docs.loading && !docs.data ? (
            <ListSkeleton rows={3} />
          ) : docs.data && docs.data.length === 0 ? (
            <EmptyState icon={<FileText className="size-6" aria-hidden />} title="No documents yet">
              {canEdit ? "Upload the notes, specs and runbooks that hold what this project knows." : "Nothing has been uploaded to this project yet."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {docs.data?.map((doc) => {
                const analyzing = analyzingId === doc.id || doc.analysis_status === "analyzing";
                const canAnalyze = canEdit && aiReady && doc.processing_status === "processed";
                return (
                  <li key={doc.id} className="py-4">
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-[11px] font-bold uppercase text-brand-ink">{doc.file_type}</span>
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="truncate text-[15px] font-semibold">{doc.filename}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatBytes(doc.size_bytes)}
                          {doc.page_count ? ` · ${doc.page_count} page${doc.page_count === 1 ? "" : "s"}` : ""}
                          {doc.char_count ? ` · ${doc.char_count.toLocaleString("en-GB")} characters` : ""}
                          {" · "}Uploaded {formatDateTime(doc.created_at)}{doc.uploaded_by_name ? ` by ${doc.uploaded_by_name}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <ProcessingBadge status={doc.processing_status} />
                          {doc.processing_status === "processed" && <AnalysisBadge status={doc.analysis_status} />}
                          {doc.knowledge_count > 0 && (
                            <Link href={`/app/projects/${project.id}/knowledge`} className="text-xs font-semibold text-brand hover:underline">
                              {doc.knowledge_count} finding{doc.knowledge_count === 1 ? "" : "s"}
                            </Link>
                          )}
                        </div>
                        {doc.processing_error && <p role="alert" className="mt-2 text-sm text-danger">{doc.processing_error}</p>}
                        {doc.analysis_status === "failed" && doc.analysis_error && <p role="alert" className="mt-2 text-sm text-danger">{doc.analysis_error}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canAnalyze && (
                          <Button size="sm" variant={doc.analysis_status === "analyzed" ? "secondary" : "primary"} onClick={() => analyze(doc)} loading={analyzing} icon={<Sparkles className="size-3.5" aria-hidden />}>
                            {analyzing ? "Analyzing…" : doc.analysis_status === "analyzed" ? "Analyze again" : "Analyze with AI"}
                          </Button>
                        )}
                        {doc.processing_status === "processed" && (
                          <Button size="sm" variant="ghost" onClick={() => openPreview(doc)} icon={<Eye className="size-3.5" aria-hidden />}>Preview</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => download(doc)} icon={<Download className="size-3.5" aria-hidden />}>Download</Button>
                        {canEdit && (
                          <Button size="sm" variant="ghost" className="px-2 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setDeleting(doc)} aria-label={`Delete ${doc.filename}`}>
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </div>
                    {analyzing && <p role="status" className="mt-2 pl-14 text-xs text-muted">The AI is reading this document. Long files can take up to a minute.</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.doc.filename ?? ""}
        description="The text HandoverIQ extracted from this file, as the AI sees it."
        size="lg"
        footer={<Button variant="secondary" onClick={() => setPreview(null)}>Close</Button>}
      >
        {preview?.error ? (
          <p role="alert" className="text-sm text-danger">{preview.error}</p>
        ) : !preview?.text ? (
          <Spinner label="Loading text…" />
        ) : (
          <>
            <pre className="whitespace-pre-wrap break-words font-serif text-[15px] leading-relaxed text-ink">{preview.text.text}</pre>
            {preview.text.truncated && (
              <p className="mt-3 text-xs text-muted">Showing the first {preview.text.text.length.toLocaleString("en-GB")} of {preview.text.total_chars.toLocaleString("en-GB")} characters.</p>
            )}
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this document?"
        confirmLabel="Delete document"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        message={<><strong className="text-ink">{deleting?.filename}</strong> will be removed. Findings you already reviewed stay in AI review, marked with the file they came from.</>}
      />
    </div>
  );
}
