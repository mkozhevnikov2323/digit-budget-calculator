export const parseDateString = (dateStr: string) => {
  const [day, month, year] = dateStr.split('.').map(Number);
  return new Date(year, month - 1, day);
};

export const sortByDate = <T extends { date?: string | Date | number }>(
  data: T[],
): T[] => {
  if (!Array.isArray(data)) return [];
  return [...data].sort((a, b) => {
    const aa =
      a.date instanceof Date
        ? a.date.getTime()
        : new Date(a.date ?? 0).getTime();
    const bb =
      b.date instanceof Date
        ? b.date.getTime()
        : new Date(b.date ?? 0).getTime();

    if (isNaN(aa) && isNaN(bb)) return 0;
    if (isNaN(aa)) return 1;
    if (isNaN(bb)) return -1;
    return aa - bb;
  });
};
