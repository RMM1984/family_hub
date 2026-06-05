export function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  const sign = amount < 0 ? "-" : "";
  const fixed = Math.abs(amount).toFixed(2);
  const [integer, decimals] = fixed.split(".");
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${groupedInteger},${decimals}\u20ac`;
}

export const formatCurrencyEs = formatCurrency;

export function formatDate(value: string | undefined | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-ES").format(new Date(value));
}
