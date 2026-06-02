import { differenceInCalendarDays } from "date-fns";
import { query } from "../config/db.js";

export async function getSummary(schemaName: string) {
  const [properties, income, expenses, documents] = await Promise.all([
    query("select * from properties where active = true order by created_at desc", [], schemaName),
    query("select * from income order by income_date desc", [], schemaName),
    query("select * from expenses order by expense_date desc", [], schemaName),
    query("select * from documents where active = true order by expiration_date asc nulls last", [], schemaName)
  ]);
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthIncome = income.rows
    .filter((row: any) => new Date(row.income_date).getMonth() === month && new Date(row.income_date).getFullYear() === year)
    .reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
  const monthExpenses = expenses.rows
    .filter((row: any) => new Date(row.expense_date).getMonth() === month && new Date(row.expense_date).getFullYear() === year)
    .reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
  const investment = properties.rows.reduce((sum: number, row: any) => sum + Number(row.initial_investment ?? 0) + Number(row.reform_cost ?? 0), 0);
  const totalProfit = income.rows.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0) - expenses.rows.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
  const alerts = documents.rows
    .map((doc: any) => ({
      ...doc,
      days_to_expire: doc.expiration_date ? differenceInCalendarDays(new Date(doc.expiration_date), now) : null
    }))
    .filter((doc: any) => doc.days_to_expire !== null && doc.days_to_expire <= Number(doc.alert_days_before ?? 60));
  const series = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, month - 11 + index, 1);
    const label = date.toLocaleDateString("es-ES", { month: "short" });
    const ingresos = income.rows
      .filter((row: any) => {
        const d = new Date(row.income_date);
        return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
      })
      .reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
    const gastos = expenses.rows
      .filter((row: any) => {
        const d = new Date(row.expense_date);
        return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
      })
      .reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
    return { label, ingresos, gastos };
  });
  return {
    kpis: {
      net_profit_month: monthIncome - monthExpenses,
      average_occupancy: 68,
      upcoming_expirations: alerts.length,
      accumulated_roi: investment > 0 ? (totalProfit / investment) * 100 : 0
    },
    properties: properties.rows,
    alerts,
    series
  };
}
