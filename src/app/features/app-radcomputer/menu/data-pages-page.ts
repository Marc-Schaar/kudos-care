import { Component, computed, inject } from '@angular/core';

import { DataPageConfig } from '../core/models';
import { RC } from '../core/paths';
import { SettingsStore } from '../core/settings-store';
import {
  FIELDS,
  FIELD_GROUPS,
  MAX_FIELDS,
  MAX_PAGES,
  effectivePages,
  fieldDef,
  pageLayout,
} from '../ride/fields';
import { SubHeader } from './sub-header';

/** Name des Felds für Liste und Vorschau, mit Gruppe als Unterzeile. */
function fieldLabel(key: string): string {
  return fieldDef(key)?.label ?? key;
}

/**
 * Datenseiten selbst belegen: welche Seiten, in welcher Reihenfolge, welche Felder. Jede
 * Änderung geht sofort in die Einstellungen (und damit ins Konto); die Fahrtseite zeigt sie
 * beim nächsten Wischen. Karte und Training hängen immer hinten an.
 */
@Component({
  selector: 'rc-data-pages-page',
  imports: [SubHeader],
  template: `
    <div class="scroll">
      <rc-sub-header title="Datenseiten" [back]="rc.settings" backLabel="Einstellungen" />

      <p class="hint intro">
        Das erste Feld einer Seite steht groß, die übrigen paarweise darunter. Bis zu
        {{ maxFields }} Felder je Seite, bis zu {{ maxPages }} Seiten. Karte und Training kommen
        immer dahinter.
      </p>

      @for (page of pages(); track $index; let p = $index) {
        <section class="page" [attr.aria-label]="'Seite ' + (p + 1) + ': ' + page.name">
          <div class="page-head">
            <span class="page-no digits">{{ p + 1 }}</span>
            <input
              class="page-name"
              type="text"
              maxlength="20"
              [value]="page.name"
              [attr.aria-label]="'Name der Seite ' + (p + 1)"
              (change)="rename(p, $event)"
            />
          </div>

          <!-- Vorschau im Seitenraster: so wird die Seite auf der Fahrt aufgeteilt. -->
          <div class="preview" aria-hidden="true" [style.grid-template-rows]="layout(page).rows">
            @for (key of page.fields; track $index; let f = $index) {
              <span [class.full]="layout(page).sizes[f] !== 'normal'">{{ label(key) }}</span>
            }
          </div>

          <ol class="fields">
            @for (key of page.fields; track $index; let f = $index) {
              <li>
                <span class="field-name">{{ label(key) }}</span>
                <button
                  type="button"
                  class="mini"
                  [disabled]="f === 0"
                  [attr.aria-label]="label(key) + ' nach oben'"
                  (click)="moveField(p, f, -1)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
                </button>
                <button
                  type="button"
                  class="mini"
                  [disabled]="f === page.fields.length - 1"
                  [attr.aria-label]="label(key) + ' nach unten'"
                  (click)="moveField(p, f, 1)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <button
                  type="button"
                  class="mini"
                  [disabled]="page.fields.length === 1"
                  [attr.aria-label]="label(key) + ' entfernen'"
                  (click)="removeField(p, f)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            }
          </ol>

          @if (page.fields.length < maxFields) {
            <div class="form-row">
              <label [attr.for]="'add-' + p">Feld hinzufügen</label>
              <select [id]="'add-' + p" (change)="addField(p, $event)">
                <option value="" selected>Feld wählen …</option>
                @for (group of groups; track group) {
                  <optgroup [label]="group">
                    @for (field of fieldsIn(group); track field.key) {
                      <option [value]="field.key">
                        {{ field.label }}{{ field.hint ? ' – ' + field.hint : '' }}
                      </option>
                    }
                  </optgroup>
                }
              </select>
            </div>
          }

          <div class="page-actions">
            <button type="button" class="btn" [disabled]="p === 0" (click)="movePage(p, -1)">
              Nach vorn
            </button>
            <button
              type="button"
              class="btn danger"
              [disabled]="pages().length === 1"
              (click)="removePage(p)"
            >
              Seite löschen
            </button>
          </div>
        </section>
      }

      <div class="stack end">
        @if (pages().length < maxPages) {
          <button type="button" class="btn primary" (click)="addPage()">Seite hinzufügen</button>
        }
        @if (custom()) {
          <button type="button" class="btn" (click)="resetPages()">
            Standardseiten wiederherstellen
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .intro {
      margin-bottom: 20px;
    }
    .page {
      padding: 14px 0 18px;
      border-top: 2px solid var(--fg);
      display: grid;
      gap: 12px;
    }
    .page-head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .page-no {
      width: 40px;
      height: 40px;
      flex: none;
      display: grid;
      place-items: center;
      border-radius: 4px;
      background: var(--fg);
      color: var(--bg);
      font-size: var(--t-xl);
    }
    .page-name {
      flex: 1;
      min-width: 0;
      min-height: 52px;
      padding: 0 12px;
      border: 2px solid var(--edge);
      border-radius: 4px;
      background: var(--bg);
      font-family: var(--digits);
      font-size: var(--t-xl);
      font-weight: 700;
    }
    .page-name:focus {
      border-color: var(--fg);
      outline: none;
    }
    /* Kleines Abbild der Fahrtseite, Haarlinien wie dort. */
    .preview {
      height: 150px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: var(--line);
      border: 1px solid var(--line);
    }
    .preview span {
      min-width: 0;
      padding: 4px 6px;
      overflow: hidden;
      background: var(--bg);
      font-family: var(--digits);
      font-size: var(--t-s);
      font-weight: 700;
      color: var(--muted);
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .preview span.full {
      grid-column: 1 / -1;
    }
    .preview span:first-child {
      color: var(--fg);
      font-size: var(--t-m);
    }
    .fields {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .fields li {
      min-height: 56px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid var(--line);
    }
    .field-name {
      flex: 1;
      min-width: 0;
      font-size: var(--t-l);
      font-weight: 600;
    }
    .mini {
      width: 48px;
      height: 48px;
      flex: none;
      display: grid;
      place-items: center;
      border: 2px solid var(--edge);
      border-radius: 4px;
    }
    .mini:disabled {
      opacity: 0.3;
    }
    .mini svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.6;
      stroke-linecap: square;
    }
    .page-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .end {
      padding-top: 18px;
      border-top: 2px solid var(--fg);
    }
  `,
})
export class DataPagesPage {
  protected readonly rc = RC;
  private readonly settings = inject(SettingsStore);

  protected readonly maxPages = MAX_PAGES;
  protected readonly maxFields = MAX_FIELDS;
  protected readonly groups = FIELD_GROUPS;
  protected readonly label = fieldLabel;
  protected readonly layout = (page: DataPageConfig) => pageLayout(page.fields.length);

  protected readonly pages = computed(() => effectivePages(this.settings.value().dataPages));
  protected readonly custom = computed(() => this.settings.value().dataPages.length > 0);

  protected fieldsIn(group: string) {
    return FIELDS.filter((f) => f.group === group);
  }

  private save(pages: DataPageConfig[]): void {
    this.settings.patch({ dataPages: pages });
  }

  private edit(p: number, change: (fields: string[]) => string[]): void {
    this.save(
      this.pages().map((page, i) =>
        i === p ? { ...page, fields: change([...page.fields]) } : page,
      ),
    );
  }

  protected rename(p: number, event: Event): void {
    const name = (event.target as HTMLInputElement).value.trim().slice(0, 20) || `Seite ${p + 1}`;
    this.save(this.pages().map((page, i) => (i === p ? { ...page, name } : page)));
  }

  protected addField(p: number, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const key = select.value;
    select.value = '';
    if (fieldDef(key)) this.edit(p, (fields) => [...fields, key].slice(0, MAX_FIELDS));
  }

  protected removeField(p: number, f: number): void {
    this.edit(p, (fields) => (fields.length > 1 ? fields.filter((_, i) => i !== f) : fields));
  }

  protected moveField(p: number, f: number, delta: number): void {
    this.edit(p, (fields) => move(fields, f, delta));
  }

  protected movePage(p: number, delta: number): void {
    this.save(move(this.pages(), p, delta));
  }

  protected removePage(p: number): void {
    if (this.pages().length > 1) this.save(this.pages().filter((_, i) => i !== p));
  }

  protected addPage(): void {
    const n = this.pages().length;
    if (n < MAX_PAGES)
      this.save([
        ...this.pages(),
        { name: `Seite ${n + 1}`, fields: ['speed', 'distance', 'time'] },
      ]);
  }

  protected resetPages(): void {
    this.save([]);
  }
}

function move<T>(list: T[], from: number, delta: number): T[] {
  const to = from + delta;
  if (to < 0 || to >= list.length) return list;
  const out = [...list];
  [out[from], out[to]] = [out[to], out[from]];
  return out;
}
