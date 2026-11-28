import { writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<any>} */
export const deferredInstallPrompt = writable(null);
export const isAppInstalled = writable(false);

let initialized = false;

export function initPWA() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Détecter si l'app tourne déjà en mode installé (standalone)
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    /** @type {any} */ (window.navigator).standalone === true;
  if (standalone) {
    isAppInstalled.set(true);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt.set(e);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt.set(null);
    isAppInstalled.set(true);
  });

  // Enregistrement du Service Worker minimal (uniquement en HTTPS ou localhost)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silencieux si bloqué en navigation privée / contexte local
      });
    });
  }
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isCriOS = /CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isWebkit && !isCriOS;
}
