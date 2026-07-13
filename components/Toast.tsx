'use client';

import { useState, useCallback } from 'react';
import { ToastContext, Toast, ToastVariant } from '@/lib/toast';

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const colors = {
    success: 'border-green-700/30 text-green-800',
    error:   'border-red-600/30 text-red-800',
    info:    'border-seam text-graphite',
  };
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-[8px] bg-raised border shadow-card max-w-sm ${colors[toast.variant]}`}>
      <p className="text-sm flex-1">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="opacity-60 hover:opacity-100 text-xs leading-none mt-0.5">
        &times;
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
