import { differenceInCalendarDays } from "date-fns";
import { query } from "../config/db.js";

export async function getSummary(schemaName: string) {
  const [properties, income, expenses, documents] = await Promise.all([
    query("select * from properties where active = true order by created_at desc", [], schemaName),
    query("select i.*, p.alias as property_alias from income i join properties p on p.id = i.property_id order by i.income_date desc", [], schemaName),
    query("select e.*, p.alias as property_alias from expenses e join properties p on p.id = e.property_id order by e.expense_date desc", [], schemaName),
    query("select d.*, p.alias as property_alias from documents d join properties p on p.id = d.property_id where d.active = true order by d.expiration_date asc nulls last", [], schemaName)
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
  const propertySummaries = properties.rows.map((property: any) => {
    const propertyIncome = income.rows
      .filter((row: any) => row.property_id === property.id && new Date(row.income_date).getMonth() === month && new Date(row.income_date).getFullYear() === year)
      .reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
    const propertyExpenses = expenses.rows
      .filter((row: any) => row.property_id === property.id && new Date(row.expense_date).getMonth() === month && new Date(row.expense_date).getFullYear() === year)
      .reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
    const nextDocument = documents.rows.find((row: any) => row.property_id === property.id && row.expiration_date && new Date(row.expiration_date) >= now);
    const nextReservation = income.rows.find((row: any) => row.property_id === property.id && row.check_in && new Date(row.check_in) >= now);
    return {
      ...property,
      month_income: propertyIncome,
      month_expenses: propertyExpenses,
      month_profit: propertyIncome - propertyExpenses,
      next_document_title: nextDocument?.title ?? null,
      next_document_expiration: nextDocument?.expiration_date ?? null,
      next_check_in: nextReservation?.check_in ?? null,
      next_guest_name: nextReservation?.guest_name ?? null
    };
  });
  const latestMovements = [
    ...income.rows.slice(0, 5).map((row: any) => ({ ...row, kind: "Ingreso", movement_date: row.income_date })),
    ...expenses.rows.slice(0, 5).map((row: any) => ({ ...row, kind: "Gasto", movement_date: row.expense_date }))
  ].sort((a: any, b: any) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime()).slice(0, 6);

  return {
    kpis: {
      net_profit_month: monthIncome - monthExpenses,
      average_occupancy: 68,
      upcoming_expirations: alerts.length,
      accumulated_roi: investment > 0 ? (totalProfit / investment) * 100 : 0
    },
    properties: propertySummaries,
    alerts,
    latest_movements: latestMovements,
    series
  };
}
