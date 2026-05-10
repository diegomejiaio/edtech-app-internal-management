/**
 * usePublishChatContext — hook for pages to publish their UI state to the
 * chat context store so ClearBookAI can be aware of what the user is viewing.
 *
 * Usage:
 *   usePublishChatContext(ctx, [dep1, dep2]);
 *
 * The context is published whenever the deps array changes (same semantics as
 * useEffect). When the component unmounts, the context is cleared automatically
 * so the LLM doesn't see stale data from a page the user has left.
 *
 * Example:
 *   usePublishChatContext({
 *     page: "comprobantes",
 *     company: { id: companyId, name: company?.business_name ?? "", ruc: company?.ruc },
 *     period,
 *     periodLabel,
 *     tab: activeTab,
 *     declarationStatus: isLocked ? "declared" : "pending",
 *     stats: {
 *       "IGV Ventas": `S/ ${igvCards.igvVentas.toFixed(2)}`,
 *       "IGV Compras": `S/ ${igvCards.igvCompras.toFixed(2)}`,
 *       "IGV a Pagar": `S/ ${igvCards.igvAPagar.toFixed(2)}`,
 *       "Comprobantes válidos": validationCounts.valido,
 *       "Comprobantes observados": validationCounts.observado,
 *       "Comprobantes rechazados": validationCounts.rechazado,
 *     },
 *   }, [companyId, period, activeTab, igvCards, validationCounts, isLocked]);
 */

import { useEffect, type DependencyList } from "react";
import type { PageContext } from "@/hooks/use-chat-context-store";
import { useChatContextStore } from "@/hooks/use-chat-context-store";

/**
 * Publishes `ctx` to the global chat context store on mount/update,
 * and clears it on unmount.
 *
 * @param ctx  The page context snapshot. Pass `null` to explicitly clear.
 * @param deps Dependency array — same semantics as `useEffect`. When omitted,
 *             runs on every render (avoid; always pass a stable deps array).
 */
export function usePublishChatContext(
  ctx: PageContext | null,
  deps: DependencyList,
): void {
  const setPageContext = useChatContextStore((s) => s.setPageContext);
  const clearPageContext = useChatContextStore((s) => s.clearPageContext);

  useEffect(() => {
    setPageContext(ctx);
    // Cleanup: clear context when this component unmounts so the LLM
    // doesn't receive stale data from a page the user has navigated away from.
    return () => {
      clearPageContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
