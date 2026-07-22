import { useState, useEffect } from 'react';

export interface Bookmark {
  id: string;
  type: 'table' | 'menu' | 'client' | 'employee';
  name: string;
  details?: string;
  path?: string; // used to identify or link
}

export function getBookmarks(): Bookmark[] {
  try {
    const data = localStorage.getItem('bistro_bookmarks');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function isBookmarked(id: string, type: Bookmark['type']): boolean {
  const bookmarks = getBookmarks();
  return bookmarks.some(b => b.id === id && b.type === type);
}

export function toggleBookmark(bookmark: Bookmark) {
  const bookmarks = getBookmarks();
  const index = bookmarks.findIndex(b => b.id === bookmark.id && b.type === bookmark.type);
  
  if (index >= 0) {
    bookmarks.splice(index, 1);
  } else {
    bookmarks.push(bookmark);
  }
  
  localStorage.setItem('bistro_bookmarks', JSON.stringify(bookmarks));
  window.dispatchEvent(new CustomEvent('bookmarks_updated', { detail: bookmarks }));
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => getBookmarks());

  useEffect(() => {
    const handleSync = () => {
      setBookmarks(getBookmarks());
    };
    window.addEventListener('bookmarks_updated', handleSync);
    return () => window.removeEventListener('bookmarks_updated', handleSync);
  }, []);

  const isItemBookmarked = (id: string, type: Bookmark['type']) => {
    return bookmarks.some(b => b.id === id && b.type === type);
  };

  return {
    bookmarks,
    isBookmarked: isItemBookmarked,
    toggleBookmark,
  };
}

