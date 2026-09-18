import { useEffect } from 'react';

// Keeps the browser tab title in sync with the event title the admin saves.
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
