import { useEffect } from "react";

/** Sets the document title + meta description for the page's lifetime, restoring the previous values on unmount. */
export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    const prevDescription = meta?.getAttribute("content") ?? null;
    if (meta) meta.setAttribute("content", description);
    return () => {
      document.title = prevTitle;
      if (meta && prevDescription != null) meta.setAttribute("content", prevDescription);
    };
  }, [title, description]);
}
