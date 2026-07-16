// Auto-generated, admin-free SEO body text summarising a geo area from EXISTING data.
// Pure (no Prisma) so it can run anywhere; callers pass already-loaded, already-localized
// values. Western digits by convention; Arabic reads naturally. Only present parts appear.
type Loc = 'ar' | 'en';

const CITY_AR = 'مدينة العبور الجديدة';
const CITY_EN = 'New Obour City';
const joinAr = (a: string[]) => a.join('، ');
const joinEn = (a: string[]) => a.join(', ');

/** "{name} في {district} بمدينة العبور الجديدة، بمساحات …، {types}، على {roads}."
 *  (name already carries its «مجاورة»/«Neighborhood» word, so we don't prepend one.) */
export function neighborhoodSummary(o: {
  name: string;
  district: string;
  areas: number[];
  assorted: boolean;
  buildingTypes: string[];
  mainRoads: string[];
  locale: Loc;
}): string {
  if (o.locale === 'ar') {
    const parts = [`${o.name} في ${o.district} ب${CITY_AR}`];
    if (o.assorted) parts.push('بمساحات قطع متنوعة');
    else if (o.areas.length) parts.push(`بمساحات قطع ${joinAr(o.areas.map(String))} م²`);
    if (o.buildingTypes.length) parts.push(joinAr(o.buildingTypes));
    if (o.mainRoads.length) parts.push(`على ${joinAr(o.mainRoads)}`);
    return parts.join('، ') + '.';
  }
  const parts = [`${o.name} in ${o.district}, ${CITY_EN}`];
  if (o.assorted) parts.push('with assorted plot areas');
  else if (o.areas.length) parts.push(`with plot areas of ${joinEn(o.areas.map(String))} m²`);
  if (o.buildingTypes.length) parts.push(joinEn(o.buildingTypes));
  if (o.mainRoads.length) parts.push(`on ${joinEn(o.mainRoads)}`);
  return parts.join(', ') + '.';
}

/** "{name} بمدينة العبور الجديدة، يضم {n} من المجاورات، بمساحات قطع من {min} إلى {max} م²."
 *  (name already carries its «الحي»/«District» word, so we don't prepend one.) */
export function districtSummary(o: {
  name: string;
  neighborhoodCount: number;
  areaMin: number | null;
  areaMax: number | null;
  locale: Loc;
}): string {
  const hasRange = o.areaMin != null && o.areaMax != null;
  if (o.locale === 'ar') {
    const parts = [`${o.name} ب${CITY_AR}`];
    if (o.neighborhoodCount > 0) parts.push(`يضم ${o.neighborhoodCount} من المجاورات`);
    if (hasRange) parts.push(o.areaMin === o.areaMax ? `بمساحات قطع ${o.areaMin} م²` : `بمساحات قطع من ${o.areaMin} إلى ${o.areaMax} م²`);
    return parts.join('، ') + '.';
  }
  const parts = [`${o.name} in ${CITY_EN}`];
  if (o.neighborhoodCount > 0) parts.push(`comprises ${o.neighborhoodCount} neighborhood${o.neighborhoodCount === 1 ? '' : 's'}`);
  if (hasRange) parts.push(o.areaMin === o.areaMax ? `with plot areas of ${o.areaMin} m²` : `with plot areas from ${o.areaMin} to ${o.areaMax} m²`);
  return parts.join(', ') + '.';
}

/** "مدينة {name} تضم {n} من الأحياء السكنية …" */
export function citySummary(o: { name: string; districtCount: number; locale: Loc }): string {
  if (o.locale === 'ar') {
    if (o.districtCount <= 0) return `${o.name} — إحدى مدن الجيل الرابع بمحافظة القليوبية.`;
    return `مدينة ${o.name} تضم ${o.districtCount} من الأحياء السكنية — استكشف مناطقها ومجاوراتها ومميزاتها والأراضي المعروضة.`;
  }
  if (o.districtCount <= 0) return `${o.name} is a fourth-generation city in Qalyubia Governorate.`;
  return `${o.name} has ${o.districtCount} residential district${o.districtCount === 1 ? '' : 's'} — explore its areas, neighborhoods, advantages and lands for sale.`;
}
