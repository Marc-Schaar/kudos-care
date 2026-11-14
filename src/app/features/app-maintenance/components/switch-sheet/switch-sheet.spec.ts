import { describe, expect, it } from 'vitest';
import { ActivationPlan } from '../../models/maintenance.models';
import { buildSwapRows } from './switch-sheet';

const plan = (overrides: Partial<ActivationPlan> = {}): ActivationPlan => ({
  activate: [],
  park: [],
  mount: [],
  unpaired: [],
  ...overrides,
});

describe('buildSwapRows', () => {
  it('pairs wheels by their position on the bike', () => {
    const rows = buildSwapRows(
      plan({
        activate: [
          { id: 1, name: 'Carbon vorne', group_name: 'Laufrad vorne' },
          { id: 2, name: 'Carbon hinten', group_name: 'Laufrad hinten' },
        ],
        park: [
          { id: 4, name: 'Alu hinten', group_name: 'Laufrad hinten' },
          { id: 3, name: 'Alu vorne', group_name: 'Laufrad vorne' },
        ],
      }),
    );
    expect(rows.map((row) => [row.where, row.on, row.off])).toEqual([
      ['Laufrad vorne', 'Carbon vorne', 'Alu vorne'],
      ['Laufrad hinten', 'Carbon hinten', 'Alu hinten'],
    ]);
  });

  it('keeps one-sided swaps instead of dropping them', () => {
    const rows = buildSwapRows(
      plan({
        activate: [{ id: 1, name: 'Carbon vorne', group_name: 'Laufrad vorne' }],
        park: [{ id: 4, name: 'Alu hinten', group_name: 'Laufrad hinten' }],
      }),
    );
    expect(rows).toEqual([
      { key: 'a1', where: 'Laufrad vorne', on: 'Carbon vorne', off: null },
      { key: 'p4', where: 'Laufrad hinten', on: null, off: 'Alu hinten' },
    ]);
  });

  it('lists linked parts by their slot, with what they replace', () => {
    const rows = buildSwapRows(
      plan({
        mount: [
          {
            component_id: 9,
            label: 'SwissStop Yellow King',
            slot_name: 'Bremsbeläge vorne',
            replaces: 'Shimano L05A',
          },
          { component_id: 10, label: 'Neu', slot_name: 'Bremsbeläge hinten', replaces: null },
        ],
      }),
    );
    expect(rows.map((row) => [row.where, row.on, row.off])).toEqual([
      ['Bremsbeläge vorne', 'SwissStop Yellow King', 'Shimano L05A'],
      ['Bremsbeläge hinten', 'Neu', null],
    ]);
  });
});
