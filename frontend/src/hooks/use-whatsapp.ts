'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNextOffset } from './infinite-list';
import {
  getConversations,
  getConversation,
  updateConversation,
  getMessages,
  sendMessage,
  aiSuggest,
  improveMessage,
  type ApiClient,
  type WaConversation,
  type WaMessage,
  type WaConversationListParams,
  type WaConversationUpdate,
  type WaSendBody,
  type WaAiSuggestion,
  type WaImproveBody,
  type WaImproveResult,
  type ListParams,
  type PaginatedResponse,
} from '@/lib/api';

/** Lists conversations with optional search/status filter. */
export function useConversations(client: ApiClient, params?: WaConversationListParams) {
  return useQuery<PaginatedResponse<WaConversation>>({
    queryKey: ['wa', 'conversations', params],
    queryFn: () => getConversations(client, params),
  });
}

/** Fetches a single conversation by ID. */
export function useConversation(client: ApiClient, id: string | undefined) {
  return useQuery<WaConversation>({
    queryKey: ['wa', 'conversation', id],
    queryFn: () => getConversation(client, id!),
    enabled: !!id,
  });
}

/** Fetches the message thread for a conversation. */
export function useMessages(
  client: ApiClient,
  conversationId: string | undefined,
  params?: ListParams,
) {
  return useQuery<PaginatedResponse<WaMessage>>({
    queryKey: ['wa', 'messages', conversationId, params],
    queryFn: () => getMessages(client, conversationId!, params),
    enabled: !!conversationId,
  });
}

/**
 * Paginated message loading for a chat thread. Fetches the latest `pageSize`
 * messages (newest first) and pages backwards on demand, so we never load the
 * full history at once. Pages arrive newest-first; the UI flattens + sorts ASC.
 */
export function useInfiniteMessages(
  client: ApiClient,
  conversationId: string | undefined,
  pageSize = 25,
) {
  return useInfiniteQuery({
    queryKey: ['wa', 'messages', 'infinite', conversationId, pageSize],
    queryFn: ({ pageParam }) => getMessages(client, conversationId!, { limit: pageSize, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: !!conversationId,
  });
}

/** Patch status/aiMode/leadState. Invalidates list + detail on success. */
export function useUpdateConversation(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: WaConversationUpdate }) =>
      updateConversation(client, vars.id, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['wa', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['wa', 'conversation', vars.id] });
    },
  });
}

/** Agent manual reply. Invalidates the thread + list on success. */
export function useSendMessage(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { conversationId: string; body: WaSendBody }) =>
      sendMessage(client, vars.conversationId, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa', 'messages'] });
      qc.invalidateQueries({ queryKey: ['wa', 'conversations'] });
    },
  });
}

/** Requests an AI-suggested reply (stub). Optional `instruction` steers the draft. */
export function useAiSuggest(client: ApiClient) {
  return useMutation<WaAiSuggestion, unknown, { conversationId: string; instruction?: string }>({
    mutationFn: ({ conversationId, instruction }) => aiSuggest(client, conversationId, instruction),
  });
}

/** Compose assistant: rewrite/proofread/adjust the agent's draft (stub). */
export function useImproveMessage(client: ApiClient) {
  return useMutation<WaImproveResult, unknown, WaImproveBody>({
    mutationFn: (body) => improveMessage(client, body),
  });
}
