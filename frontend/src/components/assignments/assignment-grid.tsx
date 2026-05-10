"use client";

import { useState, useMemo } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Edit2,
  User,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getMemberInitials, getMemberDisplayName } from "@/lib/user-utils";
import type { UserResponse, Company } from "@/types";

interface AssignmentGridProps {
  members: UserResponse[];
  companies: Company[];
  onEditMember: (member: UserResponse) => void;
}

export function AssignmentGrid({
  members,
  companies,
  onEditMember,
}: AssignmentGridProps) {
  const [search, setSearch] = useState("");
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
    new Set(),
  );

  // Filter members by search (memoized)
  const filteredMembers = useMemo(() => {
    if (!search) return members;
    const searchLower = search.toLowerCase();
    return members.filter(
      (member) =>
        member.email.toLowerCase().includes(searchLower) ||
        member.name?.toLowerCase().includes(searchLower),
    );
  }, [members, search]);

  // Create company lookup map (memoized)
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );

  const toggleMember = (memberId: string) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4 relative">
      {/* Search */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar miembro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground">
          {filteredMembers.length} de {members.length} miembros
        </span>
      </div>

      {/* Member Cards */}
      <div className="space-y-3">
        {filteredMembers.map((member) => {
          const memberId = member.user_id || member.email;
          const isExpanded = expandedMembers.has(memberId);
          const assignedCompanyIds = member.assigned_company_ids || [];
          // Use actual count from backend data (not filtered by loaded companies)
          const assignedCount = assignedCompanyIds.length;
          // For display, only show companies we have data for
          const assignedCompanies = assignedCompanyIds
            .map((id) => companyMap.get(id))
            .filter(Boolean) as Company[];

          return (
            <Collapsible
              key={memberId}
              open={isExpanded}
              onOpenChange={() => toggleMember(memberId)}
            >
              <div
                className={cn(
                  "rounded-lg border bg-card transition-colors overflow-hidden",
                  isExpanded && "ring-1 ring-primary/20",
                )}
              >
                {/* Member Header */}
                <div className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback
                      className={cn(
                        member.status === "active"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {getMemberInitials(member)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {getMemberDisplayName(member)}
                      </span>
                      {member.status === "pending" && (
                        <Badge
                          variant="outline"
                          className="text-xs gap-1 shrink-0"
                        >
                          <Clock className="h-3 w-3" />
                          Pendiente
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {member.email}
                    </p>
                  </div>

                  {/* Company Count Badge */}
                  <Badge
                    variant={assignedCount > 0 ? "default" : "secondary"}
                    className={cn(
                      "text-sm px-3 py-1 shrink-0",
                      assignedCount === 0 && "text-muted-foreground",
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    {assignedCount}{" "}
                    {assignedCount === 1 ? "empresa" : "empresas"}
                  </Badge>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditMember(member);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="sr-only">Editar asignaciones</span>
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {isExpanded ? "Colapsar" : "Expandir"}
                        </span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                {/* Expanded Content - Assigned Companies */}
                <CollapsibleContent>
                  <div className="border-t px-4 py-3 bg-muted/30">
                    {assignedCount === 0 ? (
                      <div className="flex items-center justify-center py-4 text-muted-foreground">
                        <XCircle className="h-4 w-4 mr-2" />
                        <span className="text-sm">
                          No tiene empresas asignadas
                        </span>
                        <Button
                          variant="link"
                          size="sm"
                          className="ml-2 p-0 h-auto"
                          onClick={() => onEditMember(member)}
                        >
                          Asignar ahora
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {assignedCompanies.map((company) => (
                          <div
                            key={company.id}
                            className="flex items-center gap-2 p-2 rounded-md bg-background border text-sm"
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">
                                {company.business_name}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {company.ruc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

      {filteredMembers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <User className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No se encontraron miembros que coincidan con la busqueda
          </p>
        </div>
      )}
    </div>
  );
}
