"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, getFieldErrors } from "../lib/api";
import { createProject, type Project, type ProjectInput } from "../lib/projects";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttonStyles";

// Limits mirror backend/app/schemas.py. The backend stays the authority:
// these only give the user instant feedback.
const LIMITS = {
  name: 120,
  description: 2000,
  outgoing_member: 100,
  incoming_member: 100,
} as const;

const SAME_PERSON_MESSAGE =
  "The incoming member must be a different person than the outgoing member.";

type FieldName = "name" | "description" | "outgoing_member" | "incoming_member";
type FormValues = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string>>;

// Visual order of the fields: used to find the first problem field.
const FIELD_ORDER: readonly FieldName[] = [
  "name",
  "outgoing_member",
  "incoming_member",
  "description",
];

const FIELD_IDS: Record<FieldName, string> = {
  name: "create-project-name",
  description: "create-project-description",
  outgoing_member: "create-project-outgoing",
  incoming_member: "create-project-incoming",
};

const LABELS: Record<FieldName, string> = {
  name: "Project name",
  description: "Description",
  outgoing_member: "Outgoing member",
  incoming_member: "Incoming member",
};

const EMPTY_VALUES: FormValues = {
  name: "",
  description: "",
  outgoing_member: "",
  incoming_member: "",
};

function isFieldName(value: string): value is FieldName {
  return (FIELD_ORDER as readonly string[]).includes(value);
}

function errorId(field: FieldName): string {
  return `${FIELD_IDS[field]}-error`;
}

/** Trim and squeeze every run of whitespace into one space (like the backend). */
function collapseSpaces(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(" ");
}

/** Length in characters, not UTF-16 units, so an emoji counts as 1 like on the backend. */
function charCount(value: string): number {
  return [...value].length;
}

function cleanValues(values: FormValues): FormValues {
  return {
    name: collapseSpaces(values.name),
    description: values.description.trim(),
    outgoing_member: collapseSpaces(values.outgoing_member),
    incoming_member: collapseSpaces(values.incoming_member),
  };
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const cleaned = cleanValues(values);

  for (const field of ["name", "outgoing_member", "incoming_member"] as const) {
    const value = cleaned[field];
    if (value === "") {
      errors[field] = `${LABELS[field]} is required.`;
    } else if (charCount(value) > LIMITS[field]) {
      errors[field] = `${LABELS[field]} must be at most ${LIMITS[field]} characters.`;
    }
  }

  if (charCount(cleaned.description) > LIMITS.description) {
    errors.description = `Description must be at most ${LIMITS.description} characters.`;
  }

  if (
    errors.incoming_member === undefined &&
    cleaned.outgoing_member !== "" &&
    cleaned.incoming_member.toLowerCase() === cleaned.outgoing_member.toLowerCase()
  ) {
    errors.incoming_member = SAME_PERSON_MESSAGE;
  }

  return errors;
}

/** The request body: exactly the four editable fields. There is no status. */
function toInput(values: FormValues): ProjectInput {
  const cleaned = cleanValues(values);
  return {
    name: cleaned.name,
    description: cleaned.description === "" ? null : cleaned.description,
    outgoing_member: cleaned.outgoing_member,
    incoming_member: cleaned.incoming_member,
  };
}

function omitErrors(errors: FieldErrors, fields: readonly FieldName[]): FieldErrors {
  const next: FieldErrors = {};
  for (const field of FIELD_ORDER) {
    const message = errors[field];
    if (message !== undefined && !fields.includes(field)) {
      next[field] = message;
    }
  }
  return next;
}

function inputClass(hasError: boolean): string {
  return [
    "mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm",
    "placeholder:text-gray-500 focus-visible:outline-2 focus-visible:outline-indigo-500",
    "disabled:cursor-not-allowed disabled:opacity-60",
    hasError ? "border-red-500/70" : "border-gray-400/60",
  ].join(" ");
}

function FieldError({ field, message }: { field: FieldName; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={errorId(field)}
      role="alert"
      className="mt-1 text-sm text-red-700 dark:text-red-400"
    >
      {message}
    </p>
  );
}

type TextFieldProps = {
  field: FieldName;
  value: string;
  error: string | undefined;
  disabled: boolean;
  placeholder: string;
  onChange: (field: FieldName, value: string) => void;
};

function TextField({ field, value, error, disabled, placeholder, onChange }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={FIELD_IDS[field]} className="block text-sm font-medium">
        {LABELS[field]}{" "}
        <span aria-hidden="true" className="text-red-600 dark:text-red-400">
          *
        </span>
      </label>
      <input
        id={FIELD_IDS[field]}
        name={field}
        type="text"
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId(field) : undefined}
        className={inputClass(Boolean(error))}
      />
      <FieldError field={field} message={error} />
    </div>
  );
}

type ProjectFormProps = {
  /** Called with the project exactly as the server returned it. */
  onCreated: (project: Project) => void;
  onCancel: () => void;
};

export default function ProjectForm({ onCreated, onCancel }: ProjectFormProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ field: FieldName } | null>(null);

  // A ref (not state) blocks a second submit instantly, before React re-renders.
  const submittingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    document.getElementById(FIELD_IDS.name)?.focus();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (focusTarget) {
      document.getElementById(FIELD_IDS[focusTarget.field])?.focus();
    }
  }, [focusTarget]);

  // Nothing is flagged until the first Create attempt; after that, live.
  const clientErrors: FieldErrors = attempted ? validate(values) : {};
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };

  const descriptionCount = charCount(values.description.trim());
  const descriptionTooLong = descriptionCount > LIMITS.description;

  function handleChange(field: FieldName, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    // Editing a field makes its server error stale. The same-person error
    // concerns both member fields, so editing either one clears it.
    const stale: FieldName[] =
      field === "outgoing_member" || field === "incoming_member"
        ? ["outgoing_member", "incoming_member"]
        : [field];
    setServerErrors((previous) => omitErrors(previous, stale));
  }

  function applyServerError(err: unknown) {
    const mapped: FieldErrors = {};
    const other: string[] = [];

    if (err instanceof ApiError && err.code === "duplicate_project_name") {
      // The server's full sentence reads better than the short field detail.
      mapped.name = err.message;
    } else {
      for (const [field, message] of Object.entries(getFieldErrors(err))) {
        if (isFieldName(field)) {
          mapped[field] = message;
        } else {
          other.push(message);
        }
      }
    }

    const firstMapped = FIELD_ORDER.find((field) => mapped[field] !== undefined);
    setServerErrors(mapped);

    if (other.length > 0) {
      setFormError(other.join(" "));
    } else if (!firstMapped) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong while creating the project. Please try again."
      );
    }
    if (firstMapped) {
      setFocusTarget({ field: firstMapped });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const found = validate(values);
    const firstInvalid = FIELD_ORDER.find((field) => found[field] !== undefined);
    if (firstInvalid) {
      setAttempted(true);
      setFormError(null);
      setFocusTarget({ field: firstInvalid });
      return; // nothing is sent to the server
    }

    submittingRef.current = true;
    setAttempted(true);
    setSubmitting(true);
    setFormError(null);
    setServerErrors({});

    try {
      const project = await createProject(toInput(values));
      if (!mountedRef.current) return;
      onCreated(project);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      applyServerError(err);
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      aria-labelledby="create-project-heading"
      aria-busy={submitting}
      className="space-y-5 rounded-xl border border-gray-400/40 bg-gray-500/5 p-5 shadow-sm sm:p-6"
    >
      <div>
        <h3 id="create-project-heading" className="text-lg font-semibold">
          Create a project
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Fields marked{" "}
          <span aria-hidden="true" className="text-red-600 dark:text-red-400">
            *
          </span>{" "}
          are required. New projects start as drafts.
        </p>
      </div>

      <TextField
        field="name"
        value={values.name}
        error={errors.name}
        disabled={submitting}
        placeholder="e.g. Billing platform migration"
        onChange={handleChange}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          field="outgoing_member"
          value={values.outgoing_member}
          error={errors.outgoing_member}
          disabled={submitting}
          placeholder="Person handing the project over"
          onChange={handleChange}
        />
        <TextField
          field="incoming_member"
          value={values.incoming_member}
          error={errors.incoming_member}
          disabled={submitting}
          placeholder="Person taking the project over"
          onChange={handleChange}
        />
      </div>

      <div>
        <label htmlFor={FIELD_IDS.description} className="block text-sm font-medium">
          Description <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id={FIELD_IDS.description}
          name="description"
          rows={4}
          value={values.description}
          onChange={(event) => handleChange("description", event.target.value)}
          disabled={submitting}
          placeholder="What is this project about?"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? errorId("description") : undefined}
          className={inputClass(Boolean(errors.description))}
        />
        <div className="flex items-start justify-between gap-3">
          <FieldError field="description" message={errors.description} />
          <p
            className={`ml-auto mt-1 shrink-0 text-xs ${
              descriptionTooLong ? "text-red-700 dark:text-red-400" : "text-gray-500"
            }`}
          >
            {descriptionCount} / {LIMITS.description}
          </p>
        </div>
      </div>

      {formError && (
        <div
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm font-medium text-red-700 dark:text-red-400"
        >
          {formError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
          {submitting ? "Creating…" : "Create project"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={SECONDARY_BUTTON}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}