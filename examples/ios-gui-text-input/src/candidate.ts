/** Versions 1 and 2 share the runtime identity; v2 adds text hash normalization. */
export function readCandidateIdentity(text: string): {candidateId: string; enginePackage: unknown} {
  const candidate = JSON.parse(text);
  if (!candidate || ![1, 2].includes(candidate.schemaVersion)
      || typeof candidate.candidateId !== 'string' || !candidate.candidateId
      || !candidate.enginePackage) {
    throw new Error('G06 candidate manifest is missing or invalid.');
  }
  return {candidateId: candidate.candidateId, enginePackage: candidate.enginePackage};
}
