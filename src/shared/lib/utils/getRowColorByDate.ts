export const COLORS = ['#ebedff', '#fffdeb'];

export function getRowColorIndexesByDate<T extends { date: string | Date }>(
  rows: T[],
) {
  let prevDateStr = '';
  let colorIdx = 0;
  return rows.map((row) => {
    const thisDateStr = new Date(row.date).toDateString();
    if (thisDateStr !== prevDateStr) colorIdx = 1 - colorIdx;
    prevDateStr = thisDateStr;
    return colorIdx;
  });
}
