// Generic city-state contract. Only a saved user choice is passed to this API;
// callers must not pass the repository's example city as a saved preference.
export const normalizeLocation = (value) => {
  if (!value || value.mode === 'unset' || !Number.isFinite(value.lat) || !Number.isFinite(value.lon)
      || Math.abs(value.lat) > 90 || Math.abs(value.lon) > 180) return null;
  return {version:2, mode:value.mode === 'auto' ? 'auto' : 'manual', lat:value.lat, lon:value.lon,
    name:String(value.name || 'Selected coordinates'), full:String(value.full || value.name || 'Selected coordinates')};
};
export const locateOnce = async ({consent, available, provider}) => {
  if (!consent) throw Error('Explicit location consent is required');
  if (!available) throw Error('GeoClue is unavailable');
  const location=normalizeLocation({...await provider(),mode:'auto'});
  if (!location) throw Error('Location service returned invalid coordinates');
  return location;
};
export const createCitySearch = (provider) => {
  let generation=0;
  return {cancel(){generation++},async run(query){const ticket=++generation;
    const results=await provider(query);return ticket===generation?results:null;}};
};
