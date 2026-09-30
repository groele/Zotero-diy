export function upsertMetadataMarker(
  currentValue: string,
  marker: string,
  isManagedMarker: (value: string) => boolean,
): string {
  const entries = currentValue.split(/\s*;\s*/).filter(Boolean);
  const markerIndex = entries.findIndex(isManagedMarker);

  if (markerIndex >= 0)
    entries[markerIndex] = marker;
  else if (!entries.includes(marker))
    entries.push(marker);

  return entries.join("; ");
}
