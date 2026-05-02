import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface AccordionItem {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  storageKey?: string;
  className?: string;
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    return storage &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function'
      ? storage
      : null;
  } catch {
    return null;
  }
}

function readStoredIds(storageKey: string | undefined): string[] | null {
  const storage = getLocalStorage();
  if (!storageKey || !storage) return null;
  try {
    const raw = storage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

function getDefaultOpenIds(resetSeed: string): string[] {
  try {
    const entries = JSON.parse(resetSeed) as unknown;
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) => {
      if (!Array.isArray(entry)) return [];
      const [id, defaultOpen, forceOpen] = entry;
      return typeof id === 'string' && (defaultOpen || forceOpen) ? [id] : [];
    });
  } catch {
    return [];
  }
}

function getInitialOpenIds(resetSeed: string, storageKey: string | undefined) {
  const stored = readStoredIds(storageKey);
  if (stored) return new Set(stored);
  return new Set(getDefaultOpenIds(resetSeed));
}

export function Accordion({ items, storageKey, className = '' }: AccordionProps) {
  const forcedIds = useMemo(
    () => new Set(items.filter((item) => item.forceOpen).map((item) => item.id)),
    [items],
  );
  const resetSeed = useMemo(
    () =>
      JSON.stringify(items.map((item) => [item.id, Boolean(item.defaultOpen), Boolean(item.forceOpen)])),
    [items],
  );
  const [openIds, setOpenIds] = useState(() => getInitialOpenIds(resetSeed, storageKey));

  useEffect(() => {
    setOpenIds(getInitialOpenIds(resetSeed, storageKey));
  }, [resetSeed, storageKey]);

  useEffect(() => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      for (const id of forcedIds) next.add(id);
      return next;
    });
  }, [forcedIds]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      getLocalStorage()?.setItem(storageKey, JSON.stringify([...openIds]));
    } catch {
      // no-op: storage unavailable/restricted
    }
  }, [openIds, storageKey]);

  function toggle(id: string) {
    if (forcedIds.has(id)) return;
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      for (const forcedId of forcedIds) next.add(forcedId);
      return next;
    });
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id) || item.forceOpen;
        const buttonId = `accordion-${item.id}-button`;
        const panelId = `accordion-${item.id}-panel`;

        return (
          <section
            key={item.id}
            className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80"
          >
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen ? 'true' : 'false'}
              aria-controls={panelId}
              disabled={item.disabled}
              onClick={() => toggle(item.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                  isOpen ? 'rotate-0' : '-rotate-90'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-200">
                  {item.title}
                </span>
                {item.subtitle && (
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {item.subtitle}
                  </span>
                )}
              </span>
              {item.meta && <span className="shrink-0 text-xs text-slate-500">{item.meta}</span>}
            </button>

            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="border-t border-slate-800 px-4 py-4"
              >
                {item.children}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
