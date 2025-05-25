export interface IncomeSchema {
  id: string;
  date: string; // ISO string
  amount: number;
  source: string;
  comment?: string;

  [key: string]: string | number | undefined;
}

export interface IncomeState {
  list: IncomeSchema[] | null;
}
