/** Explicit compile-time opt-in. No runtime storage override or automatic fallback. */
export const classificationGroupsV3Enabled =
  typeof __CLASSIFICATION_GROUPS_V3__ !== 'undefined' &&
  __CLASSIFICATION_GROUPS_V3__ === true;
