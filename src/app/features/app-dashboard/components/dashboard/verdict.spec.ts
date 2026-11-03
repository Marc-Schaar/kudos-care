import { describe, expect, it } from 'vitest';
import { BikeList, WarnStatus } from '../../../app-maintenance/models/maintenance.models';
import { DueItem } from '../../../app-maintenance/shared/utils/utils';
import { BikeDue, buildVerdict } from './verdict';

function bike(name: string): BikeList {
  return { id: 1, name } as BikeList;
}

function item(status: WarnStatus, ratio: number | null, title = 'Kette', remaining = 'noch 10 km'): DueItem {
  return { key: title + ratio, status, ratio, title, remaining } as DueItem;
}

function entry(name: string, ...due: DueItem[]): BikeDue {
  return { bike: bike(name), due };
}

describe('buildVerdict', () => {
  it('sagt, was zu tun ist, wenn es noch kein Rad gibt', () => {
    expect(buildVerdict([]).headline).toBe('Noch kein Rad in der Garage.');
  });

  it('erkennt ein Rad ohne eingetragene Teile', () => {
    const verdict = buildVerdict([entry('Renner')]);
    expect(verdict.headline).toBe('Renner ist noch nicht eingerichtet.');
    expect(verdict.tone).toBe('unknown');
  });

  it('zählt Dinge, nicht Räder', () => {
    const verdict = buildVerdict([
      entry('Renner', item('critical', 3), item('critical', 2), item('warn', 0.9), item('ok', 0.1)),
    ]);
    expect(verdict.headline).toBe('2 Dinge am Renner sind überfällig.');
    expect(verdict.tone).toBe('critical');
  });

  it('nennt zuerst das, was am weitesten drüber ist, und was sonst noch ansteht', () => {
    const verdict = buildVerdict([
      entry('Renner', item('critical', 2, 'Kette', '5 km drüber'), item('critical', 9, 'Akku', '20 Tage drüber'), item('warn', 0.9)),
    ]);
    expect(verdict.lead).toBe('Zuerst: Akku, 20 Tage drüber. Dazu eine Sache bald fällig.');
  });

  it('setzt die Einzahl richtig', () => {
    expect(buildVerdict([entry('Renner', item('critical', 1.2))]).headline).toBe(
      'Eine Sache am Renner ist überfällig.',
    );
  });

  it('nennt bei mehreren betroffenen Rädern kein einzelnes in der Überschrift', () => {
    const verdict = buildVerdict([
      entry('Renner', item('critical', 2)),
      entry('Gravel', item('critical', 3, 'Reifen')),
    ]);
    expect(verdict.headline).toBe('2 Dinge sind überfällig.');
    expect(verdict.lead).toBe('Zuerst am Gravel: Reifen, noch 10 km.');
  });

  it('warnt ruhiger, solange nur etwas bald fällig ist', () => {
    const verdict = buildVerdict([entry('Renner', item('warn', 0.85), item('ok', 0.1))]);
    expect(verdict.headline).toBe('Am Renner wird bald etwas fällig.');
    expect(verdict.tone).toBe('warn');
  });

  it('sagt bei grünem Rad trotzdem, was als Nächstes kommt', () => {
    const verdict = buildVerdict([entry('Renner', item('ok', 0.6, 'Kette', 'noch 709 km'))]);
    expect(verdict.headline).toBe('Am Renner ist alles in Ordnung.');
    expect(verdict.lead).toBe('Als Nächstes: Kette, noch 709 km.');
  });

  it('erfindet keine Reihenfolge, wenn nirgends eine Lebensdauer hinterlegt ist', () => {
    const verdict = buildVerdict([entry('Renner', item('unknown', null, 'Sattel', ''))]);
    expect(verdict.lead).toBe('Für die eingetragenen Teile ist noch keine Lebensdauer hinterlegt.');
  });
});
