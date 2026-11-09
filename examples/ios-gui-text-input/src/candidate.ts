/** Historical identities remain readable; v3 binds both frozen 0.2.3 packages. */
export function readCandidateIdentity(text: string): {candidateId: string; enginePackage: unknown; extensionsPackage?: unknown} {
  const candidate = JSON.parse(text);
  if (!candidate || ![1, 2, 3].includes(candidate.schemaVersion)
      || typeof candidate.candidateId !== 'string' || !candidate.candidateId
      || !candidate.enginePackage) {
    throw new Error('G06 candidate manifest is missing or invalid.');
  }
  if(candidate.schemaVersion===3){
    if(candidate.targetVersion!=='0.2.3'||candidate.releaseQualified!==false
      ||candidate.enginePackage.name!=='@haiyue/engine'||candidate.enginePackage.version!=='0.2.3'
      ||candidate.extensionsPackage?.name!=='@haiyue/extensions'||candidate.extensionsPackage.version!=='0.2.3'
      ||![candidate.enginePackage,candidate.extensionsPackage].every(p=>/^[a-f0-9]{64}$/.test(p.sha256)&&Number.isSafeInteger(p.bytes)&&p.bytes>0))throw new Error('G11 requires both exact 0.2.3 candidate packages.');
    return{candidateId:candidate.candidateId,enginePackage:candidate.enginePackage,extensionsPackage:candidate.extensionsPackage};
  }
  return {candidateId: candidate.candidateId, enginePackage: candidate.enginePackage};
}
