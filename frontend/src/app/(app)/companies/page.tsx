"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Code2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { FadeIn, StaggerList } from "@/components/motion";
import { StatCard } from "@/components/ui/stat-card";
import { SearchInput, FilterSelect } from "@/components/ui/filter-bar";
import { TableFooter, TableSkeleton } from "@/components/ui/table-footer";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading";
import { ScrollTable } from "@/components/ui/scroll-table";
import { CredentialStatus } from "@/components/companies/credential-status";
import { CompanyActions } from "@/components/companies/company-actions";
import { CredentialsDialog } from "@/components/companies/credentials-dialog";
import { ApiCredentialsDialog } from "@/components/companies/api-credentials-dialog";
import { AddCompanyDialog } from "@/components/companies/add-company-dialog";
import { DeleteCompanyDialog } from "@/components/companies/delete-company-dialog";
import { ContactsDialog } from "@/components/companies/contacts-dialog";
import { EditCompanyDialog } from "@/components/companies/edit-company-dialog";
import { useInfiniteCompanies } from "@/hooks/use-companies";
import { useAuthContext } from "@/providers/auth-provider";
import {
  fetchAllCompaniesWithContacts,
  generateCompaniesCSV,
  downloadCSV,
} from "@/lib/export-companies";
import type { Company } from "@/types";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 400;

// Filter options
const ESTADO_OPTIONS = [
  { value: "active" as const, label: "Activas" },
  { value: "inactive" as const, label: "Inactivas" },
];

const CREDENTIALS_OPTIONS = [
  { value: "configured" as const, label: "Configuradas" },
  { value: "pending" as const, label: "Pendientes" },
];

// Dialog state — only one dialog open at a time
type DialogState =
  | { type: "addCompany" }
  | { type: "credentials"; company: Company }
  | { type: "apiCredentials"; company: Company }
  | { type: "delete"; company: Company }
  | { type: "contacts"; company: Company }
  | { type: "edit"; company: Company }
  | null;

export default function CompaniesPage() {
  const [openDialog, setOpenDialog] = useState<DialogState>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { getToken } = useAuthContext();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [credentialsFilter, setCredentialsFilter] = useState<
    "all" | "configured" | "pending"
  >("all");
  const [apiCredentialsFilter, setApiCredentialsFilter] = useState<
    "all" | "configured" | "pending"
  >("all");

  // Main data query (without search - for initial load and filters)
  const baseParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      is_active: estadoFilter === "all" ? undefined : estadoFilter === "active",
      has_credentials:
        credentialsFilter === "all"
          ? undefined
          : credentialsFilter === "configured",
      has_api_credentials:
        apiCredentialsFilter === "all"
          ? undefined
          : apiCredentialsFilter === "configured",
    }),
    [estadoFilter, credentialsFilter, apiCredentialsFilter],
  );

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteCompanies(baseParams);

  // Flatten all pages into a single array
  const companies = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data?.pages]);

  // Client-side search filter first
  const localFilteredCompanies = useMemo(() => {
    if (!searchQuery) return companies;
    const searchLower = searchQuery.toLowerCase();
    return companies.filter(
      (company) =>
        company.ruc.toLowerCase().includes(searchLower) ||
        company.business_name.toLowerCase().includes(searchLower),
    );
  }, [companies, searchQuery]);

  // Debounce search for server query (only when local results are empty)
  useEffect(() => {
    if (localFilteredCompanies.length > 0 || !searchQuery) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery, localFilteredCompanies.length]);

  // Server search query (only when local has no results)
  const { data: searchData, isFetching: isSearchFetching } =
    useInfiniteCompanies({
      ...baseParams,
      search: debouncedSearch || undefined,
      enabled: !!debouncedSearch,
    });

  const searchResults = useMemo(() => {
    return searchData?.pages.flatMap((page) => page.items) ?? [];
  }, [searchData?.pages]);

  // Derived display state
  const isServerSearching = useMemo(
    () =>
      Boolean(
        searchQuery && localFilteredCompanies.length === 0 && !debouncedSearch,
      ),
    [searchQuery, localFilteredCompanies.length, debouncedSearch],
  );
  const showSearchResults = useMemo(
    () => Boolean(debouncedSearch && searchResults.length > 0),
    [debouncedSearch, searchResults.length],
  );
  const filteredCompanies = useMemo(
    () => (showSearchResults ? searchResults : localFilteredCompanies),
    [showSearchResults, searchResults, localFilteredCompanies],
  );
  const isSearchLoadingState = useMemo(
    () => Boolean(isServerSearching || (debouncedSearch && isSearchFetching)),
    [isServerSearching, debouncedSearch, isSearchFetching],
  );

  // Get counts from first page (backend calculates totals)
  const totalCount = data?.pages[0]?.total_count ?? companies.length;
  const companiesWithCredentials = data?.pages[0]?.credentials_count ?? 0;
  const companiesWithoutCredentials = totalCount - companiesWithCredentials;
  const companiesWithApiCredentials =
    data?.pages[0]?.api_credentials_count ?? 0;

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");
      const data = await fetchAllCompaniesWithContacts(token);
      const csv = generateCompaniesCSV(data);
      downloadCSV(csv, `empresas-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Error al exportar", {
        description: "No se pudo exportar el listado. Intenta de nuevo.",
      });
    } finally {
      setIsExporting(false);
    }
  }, [getToken, toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
            <p className="text-muted-foreground">
              Administra las empresas y sus credenciales SUNAT
            </p>
          </div>
          <Button onClick={() => setOpenDialog({ type: "addCompany" })}>
            <Building2 className="mr-2 h-4 w-4" />
            Nueva Empresa
          </Button>
        </div>
      </FadeIn>

      {/* Stats */}
      <StaggerList
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        staggerDelay={0.08}
      >
        <StatCard
          label="Total Empresas"
          value={totalCount}
          icon={Building2}
          isLoading={isLoading}
        />
        <StatCard
          label="Credenciales SOL"
          value={companiesWithCredentials}
          icon={KeyRound}
          isLoading={isLoading}
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="API Keys"
          value={companiesWithApiCredentials}
          icon={Code2}
          isLoading={isLoading}
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Clave SOL Pendientes"
          value={companiesWithoutCredentials}
          icon={AlertTriangle}
          isLoading={isLoading}
          valueClassName="text-amber-600 dark:text-amber-400"
        />
      </StaggerList>

      {/* Companies Table */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>Listado de Empresas</CardTitle>
              <CardDescription>
                Configura las credenciales SOL para sincronizar notificaciones
                de SUNAT
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting || totalCount === 0}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  {isExporting ? "Exportando..." : "Exportar"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Descarga todas las {totalCount} empresas con sus contactos
                </p>
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-4">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Buscar por RUC o razón social..."
                isSearching={isSearchLoadingState}
                className="w-full sm:max-w-sm"
              />
              <div className="grid grid-cols-3 sm:flex gap-2 sm:items-end">
                <FilterSelect
                  label="Estado"
                  value={estadoFilter}
                  onChange={setEstadoFilter}
                  options={ESTADO_OPTIONS}
                  allOption={{ value: "all", label: "Todos" }}
                  width="w-full sm:w-28"
                />
                <FilterSelect
                  label="Clave SOL"
                  value={credentialsFilter}
                  onChange={setCredentialsFilter}
                  options={CREDENTIALS_OPTIONS}
                  allOption={{ value: "all", label: "Todas" }}
                  width="w-full sm:w-32"
                />
                <FilterSelect
                  label="API Key"
                  value={apiCredentialsFilter}
                  onChange={setApiCredentialsFilter}
                  options={CREDENTIALS_OPTIONS}
                  allOption={{ value: "all", label: "Todas" }}
                  width="w-full sm:w-32"
                />
              </div>
            </div>

            {/* Table Content */}
            {isLoading ? (
              <TableSkeleton
                rows={5}
                columns={[
                  { width: "w-8" },
                  { width: "w-24" },
                  { width: "flex-1" },
                  { width: "w-16", height: "h-6" },
                  { width: "w-12" },
                  { width: "w-12" },
                  { width: "w-24" },
                ]}
              />
            ) : isSearchLoadingState ? (
              <LoadingSpinner text="Buscando..." />
            ) : filteredCompanies.length === 0 ? (
              <EmptyState
                icon={Building2}
                title={
                  companies.length === 0
                    ? "No hay empresas registradas"
                    : "No se encontraron empresas"
                }
                description="Contacta al administrador para agregar empresas a tu cuenta."
                hasFilters={companies.length > 0}
              />
            ) : (
              <ScrollTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>RUC</TableHead>
                      <TableHead>Razón Social</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Clave SOL</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company, index) => (
                      <TableRow key={company.id}>
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {company.ruc}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{company.business_name}</p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              company.is_active ? "default" : "secondary"
                            }
                          >
                            {company.is_active ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <CredentialStatus
                            hasCredentials={company.has_credentials}
                          />
                        </TableCell>
                        <TableCell>
                          <CredentialStatus
                            hasCredentials={company.has_api_credentials}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <CompanyActions
                            company={company}
                            onOpenEdit={(c) =>
                              setOpenDialog({ type: "edit", company: c })
                            }
                            onOpenContacts={(c) =>
                              setOpenDialog({ type: "contacts", company: c })
                            }
                            onOpenCredentials={(c) =>
                              setOpenDialog({ type: "credentials", company: c })
                            }
                            onOpenApiCredentials={(c) =>
                              setOpenDialog({
                                type: "apiCredentials",
                                company: c,
                              })
                            }
                            onOpenDelete={(c) =>
                              setOpenDialog({ type: "delete", company: c })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollTable>
            )}

            {/* Footer */}
            <TableFooter
              currentCount={filteredCompanies.length}
              totalCount={totalCount}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              isFiltered={showSearchResults || !!searchQuery}
              onLoadMore={fetchNextPage}
              entityName="empresas"
            />
          </CardContent>
        </Card>
      </FadeIn>

      {/* Dialogs */}
      <AddCompanyDialog
        open={openDialog?.type === "addCompany"}
        onOpenChange={(open) => {
          if (!open) setOpenDialog(null);
        }}
      />
      <CredentialsDialog
        company={openDialog?.type === "credentials" ? openDialog.company : null}
        open={openDialog?.type === "credentials"}
        onOpenChange={(open) => {
          if (!open) setOpenDialog(null);
        }}
      />
      <ApiCredentialsDialog
        company={
          openDialog?.type === "apiCredentials" ? openDialog.company : null
        }
        open={openDialog?.type === "apiCredentials"}
        onOpenChange={(open) => {
          if (!open) setOpenDialog(null);
        }}
      />
      <DeleteCompanyDialog
        company={openDialog?.type === "delete" ? openDialog.company : null}
        open={openDialog?.type === "delete"}
        onOpenChange={(open) => {
          if (!open) setOpenDialog(null);
        }}
      />
      <ContactsDialog
        company={openDialog?.type === "contacts" ? openDialog.company : null}
        open={openDialog?.type === "contacts"}
        onOpenChange={(open) => {
          if (!open) setOpenDialog(null);
        }}
      />
      <EditCompanyDialog
        company={openDialog?.type === "edit" ? openDialog.company : null}
        open={openDialog?.type === "edit"}
        onOpenChange={(open) => {
          if (!open) setOpenDialog(null);
        }}
      />
    </div>
  );
}
