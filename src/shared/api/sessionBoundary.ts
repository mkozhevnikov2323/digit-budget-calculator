/** One ephemeral credential lifecycle per browser JS context. Generation 1 is
 * bootstrap, established before any protected transport can run. No identity,
 * token, transaction revision or persistence is represented by this snapshot. */
type SessionSnapshot = Readonly<{ generation: number; transitioning: boolean }>;
let snapshot: SessionSnapshot = { generation: 1, transitioning: false };
const listeners = new Set<() => void>();
let pending: {
  generation: number;
  finish: () => void;
  resolve: (generation: number | null) => void;
  reject: (error: Error) => void;
} | undefined;

export const getSessionSnapshot = (): SessionSnapshot => snapshot;
export const subscribeSession = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const isCurrentSession = (generation: number): boolean =>
  snapshot.generation === generation && !snapshot.transitioning;
const publish = (value: SessionSnapshot) => {
  snapshot = value;
  listeners.forEach((listener) => listener());
};

/** The completion callback (which may close over a credential) stays outside
 * Redux. A newer transition cancels the pending completion, including login. */
export const transitionSession = (finish: () => void): Promise<number | null> => {
  pending?.resolve(null);
  const generation = snapshot.generation + 1;
  return new Promise((resolve, reject) => {
    pending = { generation, finish, resolve, reject };
    publish({ generation, transitioning: true });
  });
};

/** Called by UserProvider only after the old subtree's passive cleanups. Thus
 * credentials/cache cannot change while previous query hooks remain mounted.
 * Idempotent across StrictMode effects; not a timer/microtask handoff assumption. */
export const completeSessionTransition = (generation: number): void => {
  if (!pending || pending.generation !== generation || snapshot.generation !== generation) return;
  const completion = pending;
  pending = undefined;
  try {
    completion.finish();
    publish({ generation, transitioning: false });
    completion.resolve(generation);
  } catch {
    // Storage/transition failure remains closed. Never publish a false login.
    completion.reject(new Error('SESSION_TRANSITION_FAILED'));
  }
};
