import { collection, doc, query, where, type Firestore } from 'firebase/firestore';
import { writeBatch } from '@huishouden/pwa-kit/firestore';
import { agendaDoc, agendaId, allDayStart, type AgendaInput } from '@huishouden/pwa-kit/agenda';
import { appUrl } from '@huishouden/pwa-kit/site';
import { addDays, toYmd, type Ymd } from '@huishouden/pwa-kit/time';
import type { Meal } from './menus';

/** Slots a day can be planned in (snacks are not planned). */
export const PLAN_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

/** One planned meal: `households/{id}/mealPlan/{day}_{type}`, matching huishouden/rules. */
export interface PlannedMeal {
  day: Ymd;
  type: PlanType;
  name: string;
  meal: Meal;
  by: string;
  updatedAt: number;
}

export const slotId = (day: Ymd, type: PlanType) => `${day}_${type}`;

/** The week shown: today and the six days after. */
export function planDays(now: number = Date.now()): Ymd[] {
  const today = toYmd(now);
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

const TASKS_APP = 'tasks';
const MEALS_URL = appUrl(import.meta.env.BASE_URL ?? '/tasks/', '?mode=meals', globalThis.location?.origin ?? 'https://huishouden-piekstra.web.app');

/** The agenda record for a planned dinner, so it shows in the portal's Calendar and Today. */
const agendaRef = (day: Ymd) => `meal:${slotId(day, 'dinner')}`;

export function planCollection(db: Firestore, householdId: string) {
  return collection(db, 'households', householdId, 'mealPlan');
}

/** Planned meals from `from` to `to` (inclusive). */
export function planQuery(db: Firestore, householdId: string, from: Ymd, to: Ymd) {
  return query(planCollection(db, householdId), where('day', '>=', from), where('day', '<=', to));
}

const agendaCollection = (db: Firestore, householdId: string) => collection(db, 'households', householdId, 'agenda');

/** The agenda document a planned dinner on `day` is published as (one per day, idempotent). */
const dinnerAgendaId = (day: Ymd) => agendaId(TASKS_APP, agendaRef(day), allDayStart(day));

/** What a planned dinner publishes: an all-day "Dinner: <meal>" linking to Meals. */
export function dinnerAgenda(planned: Pick<PlannedMeal, 'day' | 'name'>): AgendaInput {
  return { ref: agendaRef(planned.day), kind: 'other', title: `Dinner: ${planned.name}`.slice(0, 120), start: allDayStart(planned.day), allDay: true, url: MEALS_URL };
}

/**
 * Plans (or replaces) one slot. A dinner is published to the household agenda in the same batch,
 * so the plan and the agenda can never disagree after a failure.
 */
export async function planMeal(db: Firestore, householdId: string, day: Ymd, type: PlanType, meal: Meal, by: string): Promise<void> {
  const planned: PlannedMeal = { day, type, name: meal.name.slice(0, 120), meal, by, updatedAt: Date.now() };
  const batch = writeBatch(db);
  batch.set(doc(planCollection(db, householdId), slotId(day, type)), planned);
  if (type === 'dinner') {
    const entry = agendaDoc(TASKS_APP, dinnerAgenda({ day, name: meal.name }), by);
    batch.set(doc(agendaCollection(db, householdId), dinnerAgendaId(day)), entry);
  }
  await batch.commit();
}

/** Clears one slot, and a dinner's agenda entry with it, in one batch. */
export async function unplanMeal(db: Firestore, householdId: string, day: Ymd, type: PlanType): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(planCollection(db, householdId), slotId(day, type)));
  if (type === 'dinner') batch.delete(doc(agendaCollection(db, householdId), dinnerAgendaId(day)));
  await batch.commit();
}

/** The slot a new idea goes to by default: its own type on the first day that is still free. */
export function firstFreeDay(days: Ymd[], plan: PlannedMeal[], type: PlanType): Ymd {
  return days.find((d) => !plan.some((p) => p.day === d && p.type === type)) ?? days[0];
}
