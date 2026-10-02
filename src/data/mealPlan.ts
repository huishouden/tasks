import { collection, deleteDoc, doc, query, setDoc, where, type Firestore } from 'firebase/firestore';
import { allDayStart, removeAgenda, replaceAgenda } from '@huishouden/pwa-kit/agenda';
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
const MEALS_URL = 'https://huishouden-tasks.web.app/?mode=meals';

/** The agenda record for a planned dinner, so it shows in the portal's Calendar and Today. */
const agendaRef = (day: Ymd) => `meal:${slotId(day, 'dinner')}`;

export function planCollection(db: Firestore, householdId: string) {
  return collection(db, 'households', householdId, 'mealPlan');
}

/** Planned meals from `from` to `to` (inclusive). */
export function planQuery(db: Firestore, householdId: string, from: Ymd, to: Ymd) {
  return query(planCollection(db, householdId), where('day', '>=', from), where('day', '<=', to));
}

/** Plans (or replaces) one slot; a dinner is published to the household agenda. */
export async function planMeal(db: Firestore, householdId: string, day: Ymd, type: PlanType, meal: Meal, by: string): Promise<void> {
  const planned: PlannedMeal = { day, type, name: meal.name.slice(0, 120), meal, by, updatedAt: Date.now() };
  await setDoc(doc(planCollection(db, householdId), slotId(day, type)), planned);
  if (type === 'dinner') {
    await replaceAgenda(db, householdId, TASKS_APP, agendaRef(day), [{ kind: 'other', title: `Dinner: ${meal.name}`.slice(0, 120), start: allDayStart(day), allDay: true, url: MEALS_URL }], { by });
  }
}

/** Clears one slot, and its agenda entry for a dinner. */
export async function unplanMeal(db: Firestore, householdId: string, day: Ymd, type: PlanType): Promise<void> {
  await deleteDoc(doc(planCollection(db, householdId), slotId(day, type)));
  if (type === 'dinner') await removeAgenda(db, householdId, TASKS_APP, agendaRef(day));
}

/** The slot a new idea goes to by default: its own type on the first day that is still free. */
export function firstFreeDay(days: Ymd[], plan: PlannedMeal[], type: PlanType): Ymd {
  return days.find((d) => !plan.some((p) => p.day === d && p.type === type)) ?? days[0];
}
