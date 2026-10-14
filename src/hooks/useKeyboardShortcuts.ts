import { useEffect } from 'react';

interface UseKeyboardShortcutsProps {
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
  onViewChange: (view: string) => void;
  currentUserRole?: string;
}

export function useKeyboardShortcuts({
  onOpenSearch,
  onOpenShortcuts,
  onViewChange,
  currentUserRole
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events when typing inside inputs, textareas, or contenteditables
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        // Exception: Ctrl+K or Cmd+K inside inputs still toggles search
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          onOpenSearch();
        }
        return;
      }

      // 1. Search: Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      // 2. Shortcuts Guide: F1 or Shift+?
      if (e.key === 'F1' || e.key === '?') {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      // 3. Navigation shortcuts: Alt + 1-9
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        switch (e.key) {
          case '1':
            onViewChange('dashboard');
            break;
          case '2':
            onViewChange('caja');
            break;
          case '3':
            onViewChange('waiter');
            break;
          case '4':
            onViewChange('kitchen');
            break;
          case '5':
            onViewChange('finance');
            break;
          case '6':
            onViewChange('inventory');
            break;
          case '7':
            onViewChange('crm');
            break;
          case '8':
            onViewChange('personal');
            break;
          case '9':
            onViewChange('menu_settings');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenSearch, onOpenShortcuts, onViewChange, currentUserRole]);
}
