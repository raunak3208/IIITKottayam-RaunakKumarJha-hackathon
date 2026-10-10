import React, { createContext, useCallback, useContext, useState } from 'react';

const ToastCtx = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((msg, type = 'success', duration = 4000) => {
    const id = ++nextId;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} role="status">
            {t.type === 'error' && <span style={{ color: 'var(--neg)' }}>&#10007;</span>}
            {t.type === 'success' && <span style={{ color: 'var(--pos)' }}>&#10003;</span>}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
