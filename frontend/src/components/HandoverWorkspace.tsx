
"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import DemoDataButton from "./DemoDataButton";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type DocumentItem = {
  id: number;
  filename: string;
  file_type: string;
  size_bytes: number;
  chunk_count: number;
  created_at: string;
};

type Claim = {
  text: string;
  status: string;
  citations: number[];
  sources: {
    chunk_id: number;
    document_name: string;
    location: string;
  }[];
};

type ReportSection = {
  name: string;
  claims: Claim[];
};

type Report = {
  title: string;
  mode: string;
  notice?: string;
  summary: string;
  sections: ReportSection[];
  missing_information: string[];
  contradictions: string[];
};

type Handover = {
  handover_id: number;
  model: string;
  generated_at: string;
  approved: boolean;
  approved_at?: string | null;
  report: Report;
};

async function request(url: string, options?: RequestInit) {
  const response = await fetch(`${API}${url}`, options);

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    throw new Error(
      body?.error?.message ||
        body?.detail ||
        `Request failed (${response.status})`
    );
  }

  return response;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}

export default function HandoverWorkspace({
  projectId,
}: {
  projectId: number;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [handover, setHandover] = useState<Handover | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadDocuments() {
    const response = await request(
      `/api/projects/${projectId}/documents`
    );

    const data = await response.json();

    setDocuments(
      Array.isArray(data) ? data : data.documents || []
    );
  }

  async function loadHandover() {
    const response = await request(
      `/api/projects/${projectId}/handover`
    );

    const data = await response.json();

    setHandover(data);
  }

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadDocuments(),
        loadHandover(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load project information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();

    // Load once for this project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function uploadFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    setUploading(true);
    setError("");
    setMessage("");

    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);

        await request(
          `/api/projects/${projectId}/documents`,
          {
            method: "POST",
            body: form,
          }
        );
      }

      await loadDocuments();

      setMessage(
        `${files.length} document(s) uploaded successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Upload failed."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function deleteDocument(documentId: number) {
    if (!window.confirm("Delete this document?")) return;

    setError("");
    setMessage("");

    try {
      await request(
        `/api/projects/${projectId}/documents/${documentId}`,
        { method: "DELETE" }
      );

      await refresh();

      setMessage("Document deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete document."
      );
    }
  }

  async function generateReport() {
    if (generating) return;

    setGenerating(true);
    setError("");
    setMessage("");
    setHandover(null);

    try {
      await request(
        `/api/projects/${projectId}/handover/generate`,
        { method: "POST" }
      );

      // Fetch the newly generated report.
      await loadHandover();

      setMessage(
        "Handover report generated successfully. Review it before approval."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Report generation failed."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function approveReport() {
    if (
      !window.confirm(
        "Have you reviewed the report and its source citations?"
      )
    ) {
      return;
    }

    setApproving(true);
    setError("");
    setMessage("");

    try {
      await request(
        `/api/projects/${projectId}/handover/approve`,
        { method: "POST" }
      );

      await loadHandover();

      setMessage("Handover approved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Approval failed."
      );
    } finally {
      setApproving(false);
    }
  }

  async function exportReport() {
    setError("");
    setMessage("");

    try {
      const response = await request(
        `/api/projects/${projectId}/handover/export`
      );

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `handover-${projectId}.md`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );

      setMessage("Handover report exported successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Export failed."
      );
    }
  }

  const sections = handover?.report.sections || [];

  const claims = sections.flatMap(
    (section) => section.claims || []
  );

  const totalClaims = claims.length;

  const supportedClaims = claims.filter(
    (claim) => claim.status === "SUPPORTED"
  ).length;

  const unsupportedClaims = claims.filter(
    (claim) => claim.status !== "SUPPORTED"
  ).length;

  const missingCount =
    handover?.report.missing_information?.length || 0;

  const button =
    "rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  const primary =
    `${button} bg-indigo-600 text-white hover:bg-indigo-700`;

  const secondary =
    `${button} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`;

  return (
    <section className="space-y-6">

      {/* WORKSPACE HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Handover workspace
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            Documents & Reports
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Collect project knowledge and prepare the handover.
          </p>
        </div>

        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Project #{projectId}
        </span>
      </div>

      {/* GLOBAL ERROR */}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {/* DOCUMENT MANAGEMENT */}

      <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">
              01. Project documents
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Upload PDF, DOCX, TXT or CSV files.
            </p>
          </div>

          <label className={`${primary} cursor-pointer`}>
            {uploading ? "Uploading..." : "＋ Upload documents"}

            <input
              type="file"
              accept=".pdf,.docx,.txt,.csv"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={uploadFiles}
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">
                Try HANDOVERIQ instantly
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Load fictional demonstration project information without uploading a file.
              </p>
            </div>

            <DemoDataButton
              projectId={projectId}
              onAdded={() => {
                void refresh();
                setMessage(
                  "Demo project information added successfully."
                );
                setError("");
              }}
            />
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-gray-500">
            Loading documents...
          </p>
        ) : documents.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <div className="text-3xl">📄</div>

            <p className="mt-2 font-semibold">
              No documents uploaded yet
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Upload project notes or use Load Demo Data to get started.
            </p>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-gray-200">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <p className="break-all font-semibold">
                    {doc.filename}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {doc.file_type.toUpperCase()} ·{" "}
                    {(doc.size_bytes / 1024).toFixed(1)} KB ·{" "}
                    {doc.chunk_count} chunks
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void deleteDocument(doc.id)}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GENERATE HANDOVER */}

      <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">

        <h3 className="text-lg font-bold">
          02. Generate handover report
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Generate a report from the documents uploaded to this project.
        </p>

        <button
          type="button"
          onClick={() => void generateReport()}
          disabled={generating || loading || documents.length === 0}
          className={`${primary} mt-4`}
        >
          {generating
            ? "Generating report..."
            : "✦ Generate handover"}
        </button>

        {generating && (
          <p
            role="status"
            className="mt-3 text-sm font-medium text-indigo-600"
          >
            Generating your handover report. Please wait...
          </p>
        )}

        {message && !generating && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800"
          >
            ✓ {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        {documents.length === 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Upload a document or load demo data first.
          </p>
        )}
      </div>

      {/* PROFESSIONAL HANDOVER REPORT */}

      {handover && (
        <div className="space-y-6 rounded-xl border border-gray-300 bg-white p-5 shadow-sm sm:p-7">

          {/* REPORT HEADER */}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                03. Handover report
              </p>

              <h3 className="mt-2 text-2xl font-bold text-gray-900">
                {handover.report.title}
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Generated on {formatDate(handover.generated_at)}
              </p>

              {handover.approved && handover.approved_at && (
                <p className="mt-1 text-sm text-green-700">
                  Approved on {formatDate(handover.approved_at)}
                </p>
              )}
            </div>

            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                handover.approved
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {handover.approved
                ? "✓ APPROVED"
                : "PENDING REVIEW"}
            </span>
          </div>

          {handover.report.notice && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-bold">Report notice</p>
              <p className="mt-1">
                {handover.report.notice}
              </p>
            </div>
          )}

          {/* REPORT STATISTICS */}

          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
              Report overview
            </h4>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  Total claims
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {totalClaims}
                </p>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-medium text-green-700">
                  Source-supported
                </p>
                <p className="mt-2 text-2xl font-bold text-green-800">
                  {supportedClaims}
                </p>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-xs font-medium text-red-700">
                  Unsupported
                </p>
                <p className="mt-2 text-2xl font-bold text-red-800">
                  {unsupportedClaims}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-700">
                  Missing information
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-800">
                  {missingCount}
                </p>
              </div>

            </div>

            <p className="mt-3 text-xs leading-5 text-gray-500">
              Source-supported means a claim has a valid document citation.
              It does not mean the claim has been independently verified.
            </p>
          </div>

          {/* EXECUTIVE SUMMARY */}

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5">
            <h4 className="font-bold text-gray-900">
              Executive summary
            </h4>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
              {handover.report.summary}
            </p>
          </div>

          {/* SECTION NAVIGATION */}

          {sections.length > 0 && (
            <nav
              aria-label="Report sections"
              className="rounded-xl border border-gray-200 p-4"
            >
              <h4 className="text-sm font-bold text-gray-800">
                Report contents
              </h4>

              <div className="mt-3 flex flex-wrap gap-2">
                {sections.map((section, index) => (
                  <a
                    key={`${section.name}-${index}`}
                    href={`#handover-section-${index}`}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {section.name}
                  </a>
                ))}

                <a
                  href="#missing-information"
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Missing information
                </a>

                <a
                  href="#contradictions"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
                >
                  Contradictions
                </a>
              </div>
            </nav>
          )}

          {/* STRUCTURED REPORT SECTIONS */}

          <div className="space-y-6">
            {sections.map((section, index) => (
              <section
                key={`${section.name}-${index}`}
                id={`handover-section-${index}`}
                className="scroll-mt-6 border-t border-gray-200 pt-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-lg font-bold text-gray-900">
                    {section.name}
                  </h4>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {section.claims.length} claim(s)
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {section.claims.map((claim, claimIndex) => {
                    const supported =
                      claim.status === "SUPPORTED";

                    const sources = claim.sources || [];

                    return (
                      <article
                        key={claimIndex}
                        className="rounded-xl border border-gray-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${
                              supported
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {supported
                              ? "✓ SOURCE-SUPPORTED"
                              : "⚠ UNSUPPORTED"}
                          </span>

                          <span className="text-xs text-gray-500">
                            {sources.length} source(s)
                          </span>
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-800">
                          {claim.text}
                        </p>

                        {sources.length > 0 && (
                          <details className="mt-3 border-t border-gray-100 pt-3">
                            <summary className="cursor-pointer text-xs font-semibold text-indigo-700 hover:text-indigo-900">
                              View source evidence
                            </summary>

                            <div className="mt-3 space-y-2">
                              {sources.map((source) => (
                                <div
                                  key={source.chunk_id}
                                  className="rounded-lg bg-indigo-50/60 p-3"
                                >
                                  <p className="break-words text-xs font-semibold text-indigo-900">
                                    {source.document_name}
                                  </p>

                                  <p className="mt-1 text-xs text-indigo-700">
                                    {source.location} · Chunk #{source.chunk_id}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {!supported && (
                          <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-800">
                            This claim has no valid source citation.
                            Verify it manually before approving the report.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* MISSING INFORMATION */}

          <section
            id="missing-information"
            className="scroll-mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-bold text-amber-950">
                Missing information
              </h4>

              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                {missingCount} item(s)
              </span>
            </div>

            {missingCount > 0 ? (
              <ul className="mt-3 space-y-3">
                {handover.report.missing_information.map(
                  (item, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm leading-6 text-amber-950"
                    >
                      <span aria-hidden="true">•</span>
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-amber-900">
                No missing information items were reported.
              </p>
            )}
          </section>

          {/* CONTRADICTIONS */}

          <section
            id="contradictions"
            className="scroll-mt-6 rounded-xl border border-red-200 bg-red-50 p-5"
          >
            <h4 className="font-bold text-red-950">
              Contradictions
            </h4>

            {(handover.report.contradictions || []).length > 0 ? (
              <ul className="mt-3 space-y-3">
                {handover.report.contradictions.map(
                  (item, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm leading-6 text-red-900"
                    >
                      <span aria-hidden="true">!</span>
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-red-900">
                No contradiction results are available.
              </p>
            )}
          </section>

          {/* APPROVAL AND EXPORT */}

          <div className="border-t border-gray-200 pt-5">
            <div className="flex flex-wrap items-center gap-3">
              {!handover.approved ? (
                <button
                  type="button"
                  onClick={() => void approveReport()}
                  disabled={
                    approving || unsupportedClaims > 0
                  }
                  className={`${button} bg-green-700 text-white hover:bg-green-800`}
                >
                  {approving
                    ? "Approving..."
                    : "✓ Approve handover"}
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800">
                  ✓ Handover approved
                </span>
              )}

              <button
                type="button"
                onClick={() => void exportReport()}
                disabled={!handover.approved}
                className={secondary}
              >
                ↓ Export report
              </button>
            </div>

            {!handover.approved && (
              <p className="mt-3 text-xs leading-5 text-gray-500">
                Review all claims and source evidence before approval.
                Approval is disabled if any claim lacks a valid citation.
                Export is enabled after approval.
              </p>
            )}

            {handover.approved && (
              <p className="mt-3 text-xs text-green-700">
                This report has been approved. You can now export it as a Markdown file.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
