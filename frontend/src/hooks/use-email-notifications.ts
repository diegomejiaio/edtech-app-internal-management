import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import type {
  EmailNotification,
  EmailNotificationsFilters,
  SendEmailRequest,
  SendEmailResponse,
  CursorPaginatedResponse,
  CursorPaginationParams,
} from "@/types";

interface UseEmailNotificationsParams
  extends CursorPaginationParams, EmailNotificationsFilters {}

type QueryParams = Record<string, string | number | undefined>;

/**
 * Remove undefined values from params for consistent query keys
 */
function cleanParams(params: QueryParams): QueryParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as QueryParams;
}

/**
 * Fetch email notifications history with filters
 * Default: last 15 days, sorted by most recent first
 */
export function useEmailNotifications(
  params: UseEmailNotificationsParams = {},
) {
  const { getToken } = useAuthContext();

  // Default to last 15 days if no date filters provided
  const defaultStartDate = params.start_date || getDefaultStartDate();

  // Clean params for consistent query key
  const queryParams = cleanParams({
    limit: params.limit || 50,
    cursor: params.cursor,
    company_id: params.company_id,
    status: params.status,
    start_date: defaultStartDate,
    end_date: params.end_date,
  });

  return useQuery({
    queryKey: ["email-notifications", queryParams],
    queryFn: async () => {
      const token = await getToken();
      return api.get<CursorPaginatedResponse<EmailNotification>>(
        "/communications/emails",
        {
          token,
          params: queryParams,
        },
      );
    },
  });
}

/**
 * Infinite scroll for email notifications
 */
export function useInfiniteEmailNotifications(
  params: Omit<UseEmailNotificationsParams, "cursor"> = {},
) {
  const { getToken } = useAuthContext();

  // Default to last 15 days
  const defaultStartDate = params.start_date || getDefaultStartDate();

  // Clean params for consistent query key
  const baseParams = cleanParams({
    limit: params.limit || 50,
    company_id: params.company_id,
    status: params.status,
    start_date: defaultStartDate,
    end_date: params.end_date,
  });

  return useInfiniteQuery({
    queryKey: ["email-notifications", "infinite", baseParams],
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      return api.get<CursorPaginatedResponse<EmailNotification>>(
        "/communications/emails",
        {
          token,
          params: {
            ...baseParams,
            cursor: pageParam,
          },
        },
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
  });
}

/**
 * Fetch a single email notification by ID
 */
export function useEmailNotification(
  notificationId: string | null | undefined,
) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["email-notification", notificationId],
    queryFn: async () => {
      if (!notificationId) throw new Error("Notification ID is required");
      const token = await getToken();
      return api.get<EmailNotification>(
        `/communications/emails/${notificationId}`,
        { token },
      );
    },
    enabled: !!notificationId,
  });
}

/**
 * Send emails to recipients
 */
export function useSendEmail() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SendEmailRequest) => {
      const token = await getToken();
      return api.post<SendEmailResponse>("/communications/emails/send", data, {
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-notifications"] });
    },
  });
}

/**
 * Retry a failed email notification
 */
export function useRetryEmail() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getToken();
      return api.post<EmailNotification>(
        `/communications/emails/${notificationId}/retry`,
        {},
        { token },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-notifications"] });
    },
  });
}

/**
 * Helper: Get date 15 days ago in ISO format
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 15);
  return date.toISOString().split("T")[0];
}
