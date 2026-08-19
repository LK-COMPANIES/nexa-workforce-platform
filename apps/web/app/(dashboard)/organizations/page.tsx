import { Badge, Card, CardContent, CardHeader, CardTitle } from "@nexa/ui";
import { ApiErrorCard } from "../../../components/shared/ApiErrorCard";
import { EmptyState } from "../../../components/shared/EmptyState";
import { OrganizationMembersTable } from "../../../components/organizations/OrganizationMembersTable";
import { apiGetCurrentOrganization, apiListOrganizationMembers } from "../../../lib/api/organizations";

export const metadata = { title: "Organization — Nexa Workforce Solutions" };

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export default async function OrganizationsPage() {
  let organization;
  try {
    organization = await apiGetCurrentOrganization();
  } catch (error) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-slate-900">Organization</h1>
        <ApiErrorCard error={error} />
      </div>
    );
  }

  const membersResult = await apiListOrganizationMembers().catch((error: unknown) => error);
  const members = Array.isArray(membersResult) ? membersResult : null;
  const membersError = Array.isArray(membersResult) ? null : membersResult;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{organization.displayName}</h1>
          <Badge variant={organization.isActive ? "success" : "destructive"}>
            {organization.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">{organization.type.replace(/_/g, " ")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <DetailRow label="Legal name" value={organization.legalName} />
            <DetailRow label="Tax identifier" value={organization.taxIdentifier ?? "—"} />
            <DetailRow label="Country" value={organization.countryCode} />
            <DetailRow label="Created" value={new Date(organization.createdAt).toLocaleDateString()} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersError ? (
            <ApiErrorCard error={membersError} />
          ) : !members || members.length === 0 ? (
            <EmptyState title="No members" description="No members are visible for this organization." />
          ) : (
            <OrganizationMembersTable members={members} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
