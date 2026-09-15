/** A successful registration alone does not mean the app is cached for offline use. */
export function registerOffline(
  onReady: () => void,
  onError: (message: string) => void,
): () => void {
  if (!import.meta.env.PROD) return () => {};
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    onError('Offline installation requires a supported browser on HTTPS or localhost.');
    return () => {};
  }

  let disposed = false;
  let ready = false;
  let checking = false;
  const disposers: Array<() => void> = [];
  const base = new URL(import.meta.env.BASE_URL, document.baseURI);
  const workerUrl = new URL('sw.js', base);
  const fail = (message: string) => {
    if (!disposed && !ready) onError(message);
  };
  const startupTimeout = window.setTimeout(() => {
    fail('Offline setup is not ready. Reconnect and reload to finish caching.');
  }, 25_000);

  const verify = () => {
    const worker = navigator.serviceWorker.controller;
    if (disposed || ready || checking || !worker || worker.state !== 'activated') return;
    if (worker.scriptURL !== workerUrl.href) return;
    checking = true;
    const channel = new MessageChannel();
    let verificationTimeout = 0;
    const finish = () => {
      checking = false;
      window.clearTimeout(verificationTimeout);
      channel.port1.close();
      channel.port2.close();
    };
    disposers.push(finish);
    channel.port1.onmessage = (event: MessageEvent<{ type?: string; ready?: boolean }>) => {
      finish();
      if (disposed) return;
      if (event.data?.type === 'OSTEO_OFFLINE_STATUS' && event.data.ready) {
        ready = true;
        window.clearTimeout(startupTimeout);
        onReady();
      } else {
        fail('Offline files are incomplete. Reconnect and reload before field use.');
      }
    };
    verificationTimeout = window.setTimeout(() => {
      finish();
      fail('Offline cache could not be verified. Reconnect and reload.');
    }, 8_000);
    worker.postMessage({ type: 'OSTEO_CHECK_OFFLINE' }, [channel.port2]);
  };

  navigator.serviceWorker.addEventListener('controllerchange', verify);
  disposers.push(() => navigator.serviceWorker.removeEventListener('controllerchange', verify));

  // An already-installed worker can verify its cache without a network update.
  // Do not make offline readiness depend on register() reaching the server.
  verify();
  void navigator.serviceWorker.ready.then(verify);

  void navigator.serviceWorker.register(workerUrl.href, {
    scope: base.href,
    updateViaCache: 'none',
  }).then((registration) => {
    if (disposed) return;
    const watchInstalling = () => {
      const installing = registration.installing;
      if (!installing) return;
      const stateChanged = () => {
        if (installing.state === 'redundant' && !registration.active) {
          fail('Offline installation failed. Reconnect and reload to try again.');
        }
        verify();
      };
      installing.addEventListener('statechange', stateChanged);
      disposers.push(() => installing.removeEventListener('statechange', stateChanged));
      stateChanged();
    };
    registration.addEventListener('updatefound', watchInstalling);
    disposers.push(() => registration.removeEventListener('updatefound', watchInstalling));
    watchInstalling();
    verify();
    void navigator.serviceWorker.ready.then(verify);
  }).catch(() => {
    fail('Offline installation failed. Open the production preview and reconnect to try again.');
  });

  return () => {
    disposed = true;
    window.clearTimeout(startupTimeout);
    disposers.forEach((dispose) => dispose());
  };
}
