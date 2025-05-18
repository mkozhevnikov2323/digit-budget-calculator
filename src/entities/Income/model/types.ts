export interface IncomeSchema {
  id: string;
  date: string; // ISO string
  amount: number;
  source: string;
  comment?: string;
}

export interface IncomeState {
  list: IncomeSchema[] | null;
}
