export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastPayload { id: number; type: ToastType; message: string; }
export interface ProgressPayload { visible: boolean; title: string; detail?: string; percent?: number; }

type Listener<T> = (payload: T) => void;
const toastListeners = new Set<Listener<ToastPayload>>();
const progressListeners = new Set<Listener<ProgressPayload>>();
let toastId = 0;

export const uiFeedback = {
  onToast(listener: Listener<ToastPayload>) { toastListeners.add(listener); return () => { toastListeners.delete(listener); }; },
  onProgress(listener: Listener<ProgressPayload>) { progressListeners.add(listener); return () => { progressListeners.delete(listener); }; },
  notify(message: string, type: ToastType = 'info') {
    const payload = { id: ++toastId, type, message };
    toastListeners.forEach((listener) => listener(payload));
  },
  progress(title: string, detail = '', percent?: number) {
    progressListeners.forEach((listener) => listener({ visible: true, title, detail, percent }));
  },
  updateProgress(title: string, detail = '', percent?: number) {
    progressListeners.forEach((listener) => listener({ visible: true, title, detail, percent }));
  },
  hideProgress() {
    progressListeners.forEach((listener) => listener({ visible: false, title: '' }));
  },
};
