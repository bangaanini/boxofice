"use client";

import * as React from "react";

type LazyMountProps = {
  children: React.ReactNode;
  className?: string;
  fallback?: React.ReactNode;
  minHeight?: number | string;
  rootMargin?: string;
  once?: boolean;
};

export function LazyMount({
  children,
  className,
  fallback = null,
  minHeight = 320,
  rootMargin = "600px 0px",
  once = true,
}: LazyMountProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const node = containerRef.current;

    if (!node) {
      return;
    }

    if (
      typeof IntersectionObserver === "undefined" ||
      typeof window === "undefined"
    ) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          setIsVisible(true);

          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [once, rootMargin]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={!isVisible ? { minHeight } : undefined}
    >
      {isVisible ? children : fallback}
    </div>
  );
}
