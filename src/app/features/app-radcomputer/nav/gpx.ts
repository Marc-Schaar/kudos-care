export interface GpxTrack {
  name: string;
  coords: [number, number][];
}

/** Liest Track-, sonst Routenpunkte aus einer GPX-Datei (Komoot, Strava, BRouter …). */
export function parseGpx(xml: string, fallbackName = 'GPX-Route'): GpxTrack {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length)
    throw new Error('Die Datei ist kein gültiges GPX.');

  let nodes = doc.getElementsByTagName('trkpt');
  if (!nodes.length) nodes = doc.getElementsByTagName('rtept');
  const coords: [number, number][] = [];
  for (const node of Array.from(nodes)) {
    const lat = Number(node.getAttribute('lat'));
    const lon = Number(node.getAttribute('lon'));
    if (Number.isFinite(lat) && Number.isFinite(lon)) coords.push([lat, lon]);
  }
  if (coords.length < 2) throw new Error('In der GPX-Datei steht keine Strecke.');

  const nameNode = doc.querySelector('trk > name, rte > name, metadata > name');
  return { name: nameNode?.textContent?.trim() || fallbackName, coords };
}
