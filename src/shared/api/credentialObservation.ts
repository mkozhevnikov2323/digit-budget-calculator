/** One observer for the application's outer UserProvider. The comparison value
 * is private, ephemeral lifecycle bookkeeping, never Redux/context/persistence.
 * Browser event payloads are not credentials: always read the actual storage. */
let observation: { credential: string | null; pending: boolean; invalidate: () => void } | undefined;

/** True also while an observed external change awaits the unmount barrier:
 * callers must not apply an old local action during that adoption. */
export const checkCredentialChange = (): boolean => {
  if (!observation) return false;
  const current = localStorage.getItem('token');
  if (current === observation.credential) return observation.pending;
  observation.credential = current;
  observation.pending = true;
  observation.invalidate();
  return true;
};

/** Only after an official local write or a detached-subtree adoption. */
export const acknowledgeCredential = (): void => {
  if (observation) {
    observation.credential = localStorage.getItem('token');
    observation.pending = false;
  }
};

export const observeCredentialChanges = (invalidate: () => void): (() => void) => {
  const own = { credential: localStorage.getItem('token'), pending: false, invalidate };
  observation = own;
  const check = () => { if (observation === own) checkCredentialChange(); };
  const storage = (event: StorageEvent) => {
    if (event.storageArea === localStorage && (event.key === 'token' || event.key === null)) check();
  };
  const visible = () => { if (document.visibilityState === 'visible') check(); };
  window.addEventListener('storage', storage);
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', visible);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener('focus', check);
    window.removeEventListener('pageshow', check);
    document.removeEventListener('visibilitychange', visible);
    if (observation === own) observation = undefined;
  };
};
