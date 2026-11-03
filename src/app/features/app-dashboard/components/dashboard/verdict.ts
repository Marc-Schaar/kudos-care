import { BikeList, WarnStatus } from '../../../app-maintenance/models/maintenance.models';
import { DueItem } from '../../../app-maintenance/shared/utils/utils';

/** Ein Rad mit allem, was daran gerade Lebensdauer verbraucht. */
export interface BikeDue {
  bike: BikeList;
  due: DueItem[];
}

export interface Verdict {
  headline: string;
  lead: string;
  tone: WarnStatus;
}

const count = (items: DueItem[], status: WarnStatus): number =>
  items.filter((item) => item.status === status).length;

function subject(amount: number): string {
  return amount === 1 ? 'Eine Sache' : `${amount} Dinge`;
}

/** "Kette, noch 709 km" oder nur "Kette", wenn es keine Grenze gibt, gegen die man misst. */
function describe(item: DueItem): string {
  return item.remaining ? `${item.title}, ${item.remaining}` : item.title;
}

/**
 * Der eine Satz oben auf der Startseite. Er beantwortet die Frage, wegen der man die App öffnet,
 * bevor man eine Zahl lesen muss, und zählt Dinge statt Räder: vorher stand hier "1 überfällig",
 * während die Rad-Seite daneben "6 überfällig" meldete.
 */
export function buildVerdict(entries: BikeDue[]): Verdict {
  if (entries.length === 0) {
    return {
      headline: 'Noch kein Rad in der Garage.',
      lead: 'Hol deine Räder von Strava oder leg eins von Hand an.',
      tone: 'unknown',
    };
  }

  const withParts = entries.filter((entry) => entry.due.length > 0);
  if (withParts.length === 0) {
    return {
      headline:
        entries.length === 1
          ? `${entries[0].bike.name} ist noch nicht eingerichtet.`
          : 'Deine Räder sind noch nicht eingerichtet.',
      lead: 'Trag die Teile ein, dann rechnet Kudos Care mit.',
      tone: 'unknown',
    };
  }

  const all = withParts
    .flatMap((entry) => entry.due.map((item) => ({ item, bike: entry.bike })))
    .sort((a, b) => (b.item.ratio ?? -1) - (a.item.ratio ?? -1));
  const items = all.map((entry) => entry.item);
  const critical = count(items, 'critical');
  const warn = count(items, 'warn');
  const first = all[0];
  const affected = (status: WarnStatus): BikeDue[] =>
    withParts.filter((entry) => count(entry.due, status) > 0);
  // Bei mehreren Rädern muss dabeistehen, an welchem das Erste hängt.
  const where = withParts.length > 1 ? ` am ${first.bike.name}` : '';

  if (critical > 0) {
    const bikes = affected('critical');
    const verb = critical === 1 ? 'ist' : 'sind';
    const place = bikes.length === 1 ? ` am ${bikes[0].bike.name}` : '';
    const more = warn > 0 ? ` Dazu ${warn === 1 ? 'eine Sache' : `${warn} Dinge`} bald fällig.` : '';
    return {
      headline: `${subject(critical)}${place} ${verb} überfällig.`,
      lead: `Zuerst${where}: ${describe(first.item)}.${more}`,
      tone: 'critical',
    };
  }

  if (warn > 0) {
    const bikes = affected('warn');
    return {
      headline:
        bikes.length === 1
          ? `Am ${bikes[0].bike.name} wird bald etwas fällig.`
          : 'An deinen Rädern wird bald etwas fällig.',
      lead: `Zuerst${where}: ${describe(first.item)}.`,
      tone: 'warn',
    };
  }

  const next = first.item.ratio === null ? null : first;
  return {
    headline:
      withParts.length === 1
        ? `Am ${withParts[0].bike.name} ist alles in Ordnung.`
        : 'An deinen Rädern ist alles in Ordnung.',
    lead: next
      ? `Als Nächstes${where}: ${describe(next.item)}.`
      : 'Für die eingetragenen Teile ist noch keine Lebensdauer hinterlegt.',
    tone: 'ok',
  };
}
