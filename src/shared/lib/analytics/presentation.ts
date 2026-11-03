/** Display only: never change identity strings, calendar keys or accounting UTC. */
export const layerLabel = (key: string): string =>
  ({
    everyday: 'Повседневные расходы',
    irregular: 'Нерегулярные расходы',
    emergency: 'Непредвиденные расходы',
    major_goals: 'Крупные цели',
    long_term_capital: 'Долгосрочный капитал',
    reserve: 'Резерв',
  })[key] ?? key;
export const roleLabel = (key: string): string =>
  ({
    ordinary_expense: 'Обычный расход',
    ordinary_income: 'Обычное поступление',
    loan_issuance: 'Выдача займа',
    loan_repayment: 'Возврат займа',
    refund: 'Возврат покупки',
    internal_transfer: 'Внутренний перевод',
    capital_movement: 'Движение капитала',
  })[key] ?? key;
export const statusLabel = (key: string): string =>
  ({
    approved: 'Подтверждено',
    unreviewed: 'Не рассмотрено',
    explicit_unclassified: 'Явно без классификации',
    cleared: 'Сброшено',
    stale: 'Устарело',
    blocked: 'Заблокировано',
    elapsed: 'Завершён',
    partial_period: 'Часть месяца',
    current_partial: 'Текущий месяц',
    future: 'Будущий месяц',
    complete: 'Полное',
    partial: 'Частичное',
    unavailable: 'Недоступно',
  })[key] ?? 'Недоступно';
export const methodLabel = (key: string): string =>
  ({
    median_monthly: 'Медиана по месяцам',
    historical_allocation: 'Распределение истории',
    requires_user_target: 'Ручная цель',
  })[key] ?? 'Недоступно';
export const dateLabel = (value: string | number): string => {
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCFullYear()).padStart(4, '0')}`
    : 'Дата недоступна';
};
export const monthLabel = (key: string): string => {
  const d = new Date(`${key}-01T00:00:00Z`);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric',
      }).format(d)
    : 'Месяц недоступен';
};
export const timeLabel = (value: number): string =>
  `${dateLabel(value)} ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value))}.${String(new Date(value).getUTCMilliseconds()).padStart(3, '0')} UTC`;
export const factLabel = (key: string): string =>
  ({
    amount: 'Сумма',
    date: 'Дата',
    category: 'Категория',
    title: 'Название',
    recipient: 'Получатель',
    source: 'Источник',
    comment: 'Комментарий',
  })[key] ?? key;
