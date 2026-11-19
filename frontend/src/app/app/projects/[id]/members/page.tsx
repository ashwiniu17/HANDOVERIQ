"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { MailPlus, Trash2, UserPlus } from "lucide-react";
import { useProject } from "@/components/features/ProjectContext";
import { RoleBadge } from "@/components/features/StatusBadges";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Field";
import { ErrorState, ListSkeleton, Notice } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage, getFieldErrors } from "@/lib/api";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/format";
import { useResource } from "@/lib/hooks";
import type { AccessRole, Member, MemberRole } from "@/lib/types";
import { firstError, validateEmail } from "@/lib/validation";

const ASSIGNABLE: MemberRole[] = ["outgoing", "incoming", "collaborator"];

export default function MembersPage() {
  const { project, canManage, reload: reloadProject } = useProject();
  const toast = useToast();
  const { data: members, error, loading, reload } = useResource(() => api.members.list(project.id), project.id);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<MemberRole>("outgoing");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    const found = firstError({ email: validateEmail(email) });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setAdding(true);
    try {
      const added = await api.members.add(project.id, { email: email.trim(), name: name.trim() || undefined, role });
      toast.success(
        added.has_account
          ? `${added.name} was added and can open the project now.`
          : `${added.name} was added. They will get access as soon as they create an account with ${added.email}.`
      );
      setEmail("");
      setName("");
      reload();
      reloadProject();
    } catch (err) {
      const fields = getFieldErrors(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) toast.error(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(member: Member, next: MemberRole) {
    if (member.id === null) return;
    try {
      await api.members.changeRole(project.id, member.id, next);
      toast.success(`${member.name} is now ${ROLE_LABEL[next].toLowerCase()}.`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      reload(); // put the dropdown back to the real value
    }
  }

  async function remove() {
    if (!removing || removing.id === null) return;
    setRemoveBusy(true);
    try {
      await api.members.remove(project.id, removing.id);
      toast.success(`${removing.name} was removed.`);
      setRemoving(null);
      reload();
      reloadProject();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="mb-3 text-lg font-bold tracking-tight">People on this project</h2>
        <div className="rounded-2xl border border-line bg-surface px-5">
          {error && !members ? (
            <div className="py-5"><ErrorState message={error.message} onRetry={reload} /></div>
          ) : loading && !members ? (
            <ListSkeleton rows={3} />
          ) : (
            <ul className="divide-y divide-line">
              {members?.map((member) => (
                <li key={member.id ?? "owner"} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                  <Avatar name={member.name} className="size-9" />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-semibold">{member.name}</p>
                    <p className="truncate text-xs text-muted">{member.email}</p>
                  </div>
                  {!member.has_account && <Badge tone="warning" icon={<MailPlus className="size-3" aria-hidden />}>Waiting for sign-up</Badge>}
                  {canManage && !member.is_owner ? (
                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`role-${member.id}`}>Role of {member.name}</label>
                      <select
                        id={`role-${member.id}`}
                        value={member.role}
                        onChange={(e) => changeRole(member, e.target.value as MemberRole)}
                        className="h-8 rounded-lg border border-line-strong bg-surface px-2 pr-7 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
                      >
                        {ASSIGNABLE.map((value) => <option key={value} value={value}>{ROLE_LABEL[value]}</option>)}
                      </select>
                      <Button variant="ghost" size="sm" className="px-2 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setRemoving(member)} aria-label={`Remove ${member.name}`}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <h3 className="mb-2 mt-8 text-sm font-bold">What each role can do</h3>
        <dl className="space-y-3 text-sm">
          {(["owner", "outgoing", "incoming", "collaborator"] as AccessRole[]).map((value) => (
            <div key={value} className="flex gap-3">
              <dt className="w-36 shrink-0 font-semibold text-ink">{ROLE_LABEL[value]}</dt>
              <dd className="text-ink-soft">{ROLE_HELP[value]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="add-heading">
        <h2 id="add-heading" className="mb-3 text-lg font-bold tracking-tight">Add a person</h2>
        {canManage ? (
          <form onSubmit={add} noValidate className="space-y-4 rounded-2xl border border-line bg-surface p-5">
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="off" hint="If they already have an account they get access immediately. If not, as soon as they sign up with this address." />
            <Input label="Name" optional value={name} onChange={(e) => setName(e.target.value)} error={errors.name} hint="Only used when they have no account yet." />
            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as MemberRole)} error={errors.role}>
              {ASSIGNABLE.map((value) => <option key={value} value={value}>{ROLE_LABEL[value]}</option>)}
            </Select>
            <Button type="submit" loading={adding} icon={<UserPlus className="size-4" aria-hidden />} className="w-full">Add to project</Button>
            <p className="text-xs leading-relaxed text-muted">
              HandoverIQ does not send e-mails yet. Tell the person to sign up or sign in with this address.
            </p>
          </form>
        ) : (
          <Notice>Only the project owner can add or remove people.</Notice>
        )}
      </section>

      <ConfirmDialog
        open={removing !== null}
        title="Remove this person?"
        confirmLabel="Remove"
        busy={removeBusy}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
        message={<>{removing?.name} will lose access to this project straight away. Their past activity stays in the history.</>}
      />
    </div>
  );
}
