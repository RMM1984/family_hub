export function formatCurrency(value: number | null | undefined) {
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0))}€`;
}

export const formatCurrencyEs = formatCurrency;

export function formatDate(value: string | undefined | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-ES").format(new Date(value));
}
