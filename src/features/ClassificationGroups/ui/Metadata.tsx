import { useEffect, useRef } from 'react';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { checkCredentialChange } from 'shared/api/credentialObservation';
import { Alert, Button, Stack } from '@mui/material';
import {
  scopeKey,
  useGroupMetadataMutation,
  failureMessage,
  type MetadataWrite,
} from '../api/groupsApi';
/** Fixed session cache key preserves unknown-write lock across route unmounts. */
export const useMetadata = (owner: VerifiedOwner) => {
  const [write, state] = useGroupMetadataMutation({
    fixedCacheKey: `groups-metadata/${scopeKey(owner)}`,
  });
  const flight = useRef(false),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const current = () =>
    live.current &&
    !checkCredentialChange() &&
    isCurrentSession(owner.sessionGeneration);
  const failure = state.error ? failureMessage(state.error) : null;
  const busy = state.isLoading,
    blocked = busy || !!failure?.unknown;
  const run = async (action: Omit<MetadataWrite, keyof VerifiedOwner>) => {
    if (flight.current || blocked || !current()) return false;
    flight.current = true;
    try {
      await write({ ...owner, ...action }).unwrap();
      return current();
    } catch {
      return false;
    } finally {
      flight.current = false;
    }
  };
  const refresh = async (read: () => Promise<unknown>) => {
    if (busy || !current()) return false;
    try {
      await read();
      if (!current()) return false;
      state.reset();
      return true;
    } catch {
      return false;
    }
  };
  return { run, busy, blocked, failure, refresh };
};
export const MetadataFeedback = ({
  meta,
  refresh,
}: {
  meta: ReturnType<typeof useMetadata>;
  refresh: () => Promise<unknown>;
}) => (
  <Stack spacing={1}>
    {meta.failure && (
      <Alert severity={meta.failure.unknown ? 'warning' : 'error'}>
        {meta.failure.message}
      </Alert>
    )}
    {meta.failure && (
      <Button
        disabled={meta.busy}
        onClick={() => void meta.refresh(refresh)}
      >
        Обновить список без повторной записи
      </Button>
    )}
  </Stack>
);
