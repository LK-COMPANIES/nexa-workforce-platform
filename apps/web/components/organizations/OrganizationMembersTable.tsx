import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@nexa/ui";
import type { OrganizationMemberSummary } from "../../types/api";

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "success" | "destructive" | "warning"> = {
  INVITED: "secondary",
  ACTIVE: "success",
  SUSPENDED: "warning",
  REVOKED: "destructive",
};

export function OrganizationMembersTable({ members }: { members: OrganizationMemberSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last login</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium text-slate-900">
              {member.user.firstName} {member.user.lastName}
              {!member.user.isActive && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  Deactivated
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-slate-600">{member.user.email}</TableCell>
            <TableCell className="text-slate-600">{member.role.name}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[member.status] ?? "secondary"}>{member.status}</Badge>
            </TableCell>
            <TableCell className="text-slate-600">
              {member.user.lastLoginAt ? new Date(member.user.lastLoginAt).toLocaleString() : "Never"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
