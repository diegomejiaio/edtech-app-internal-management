"use client";

import {
  ReactNode,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import { cn } from "@/lib/utils";

interface ScrollTableProps {
  children: ReactNode;
  minWidth?: string;
  className?: string;
}

type ScrollState = "start" | "middle" | "end" | "none";

export function ScrollTable({
  children,
  minWidth = "640px",
  className,
}: ScrollTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState<ScrollState>("start");
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;

    setHasOverflow(scrollWidth > clientWidth);

    // Sync top phantom scrollbar content width to match actual table scroll width
    if (topScrollRef.current) {
      const inner = topScrollRef.current
        .firstElementChild as HTMLElement | null;
      if (inner) inner.style.width = `${scrollWidth}px`;
    }

    // No scroll needed
    if (scrollWidth <= clientWidth) {
      setScrollState("none");
      return;
    }

    // At start (can scroll right)
    if (scrollLeft <= 1) {
      setScrollState("start");
    }
    // At end (can scroll left)
    else if (scrollLeft + clientWidth >= scrollWidth - 1) {
      setScrollState("end");
    }
    // In middle (can scroll both ways)
    else {
      setScrollState("middle");
    }
  }, []);

  // Sync main scroller → top phantom
  const handleMainScroll = useCallback(() => {
    updateScrollState();
    if (topScrollRef.current && scrollRef.current) {
      if (topScrollRef.current.scrollLeft !== scrollRef.current.scrollLeft) {
        topScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
      }
    }
  }, [updateScrollState]);

  // Sync top phantom → main scroller
  const handleTopScroll = useCallback(() => {
    if (scrollRef.current && topScrollRef.current) {
      if (scrollRef.current.scrollLeft !== topScrollRef.current.scrollLeft) {
        scrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      }
      updateScrollState();
    }
  }, [updateScrollState]);

  // Use layout effect to measure DOM before paint
  // Intentional: setState in layout effect for pre-paint DOM measurement
  // (avoids layout thrashing on scroll indicator visibility).
  // This pattern is safe because updateScrollState must sync scroll state
  // before the browser paints, preventing jank on initial render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => {
    updateScrollState();

    // Update on resize
    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [updateScrollState]);

  const showLeftShadow = scrollState === "middle" || scrollState === "end";
  const showRightShadow = scrollState === "start" || scrollState === "middle";

  return (
    <div className={cn("relative", className)}>
      {/* Top phantom scrollbar — only visible when table overflows */}
      {hasOverflow && (
        <div
          ref={topScrollRef}
          className="overflow-x-scroll overflow-y-hidden"
          style={{ height: 10 }}
          onScroll={handleTopScroll}
          aria-hidden="true"
        >
          <div style={{ minWidth, height: 1 }} />
        </div>
      )}

      {/* Left scroll indicator */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
          showLeftShadow ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Scrollable container */}
      {/* [&_[data-slot=table-container]]:overflow-visible neutralises the Table
          component's own overflow-x-auto wrapper so only ScrollTable scrolls. */}
      <div
        ref={scrollRef}
        className="overflow-x-auto [&_[data-slot=table-container]]:overflow-visible"
        onScroll={handleMainScroll}
      >
        <div style={{ minWidth }}>{children}</div>
      </div>

      {/* Right scroll indicator */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
          showRightShadow ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />
    </div>
  );
}
