export type VerifiedOwner = Readonly<{
  userId: string;
  sessionGeneration: number;
}>;

export type VerifiedOwnerError =
  | 'invalid_response'
  | 'invalid_user_id'
  | 'invalid_generation'
  | 'request_failed'
  | 'identity_changed'
  | 'provider_missing';

export type VerifiedOwnerState =
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'verifying' }
  | { readonly status: 'verification_error'; readonly reason: VerifiedOwnerError }
  | { readonly status: 'verified'; readonly owner: VerifiedOwner };

/** Validate only the owner boundary. Email is neither an identifier nor proof
 * of ownership. No coercion, normalization, JWT decoding or ObjectId assumption. */
export const validateVerifiedOwner = (
  payload: unknown,
  sessionGeneration: number,
): Extract<VerifiedOwnerState, { status: 'verified' | 'verification_error' }> => {
  if (!Number.isSafeInteger(sessionGeneration) || sessionGeneration < 1) {
    return { status: 'verification_error', reason: 'invalid_generation' };
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { status: 'verification_error', reason: 'invalid_response' };
  }
  if (!Object.prototype.hasOwnProperty.call(payload, '_id') ||
      !('_id' in payload) || typeof payload._id !== 'string' ||
      payload._id.length === 0 || /\s/u.test(payload._id)) {
    return { status: 'verification_error', reason: 'invalid_user_id' };
  }
  return { status: 'verified', owner: { userId: payload._id, sessionGeneration } };
};
