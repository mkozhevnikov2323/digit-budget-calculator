import type { StableAssignment } from './contract';
/** Temporary personal rules approved by this application's owner. Not universal
 * financial policy. A future user-specific configuration can replace this list. */
export const TEMPORARY_CATEGORY_RULES = [
  {category:'Продукты',assignment:{economicRole:'ordinary_expense',layer:'everyday'}},
  {category:'Аптеки',assignment:{economicRole:'ordinary_expense',layer:'irregular'}},
  {category:'Фастфуд',assignment:{economicRole:'ordinary_expense',layer:'irregular'}},
  {category:'Чаевые',assignment:{economicRole:'ordinary_expense',layer:'irregular'}},
  {category:'Подарки',assignment:{economicRole:'ordinary_expense',layer:'irregular'}},
  {category:'Бар',assignment:{economicRole:'ordinary_expense',layer:'irregular'}},
  {category:'Подписки',assignment:{economicRole:'ordinary_expense',layer:'everyday'}},
  {category:'Такси',assignment:{economicRole:'ordinary_expense',layer:'everyday'}},
] as const satisfies readonly {category:string;assignment:StableAssignment}[];
