import { differenceInCalendarDays } from "date-fns";
import { query } from "../config/db.js";

export async function getSummary(schemaName: string) {
  const [properties, income, expenses, documents, reservations] = await Promise.all([
    query("select * from properties where active = true order by created_at desc", [], schemaName),
    query("select i.*, p.alias as property_alias from income i join properties p on p.id = i.property_id order by i.income_date desc", [], schemaName),
    query("select e.*, p.alias as property_alias from expenses e join properties p on p.id = e.property_id order by e.expense_date desc", [], schemaName),
    query("select d.*, p.alias as property_alias from documents d join properties p on p.id = d.property_id where d.active = true order by d.expiration_date asc nulls last", [], schemaName),
    query(
      `select pr.*, p.alias as property_alias, i.id as income_id, i.amount as income_amount, i.amount_status as income_amount_status
       from property_reservations pr
       join properties p on p.id = pr.property_id
       left join income i on i.reservation_id = pr.id and i.property_id = pr.property_id
       order by pr.check_in asc`,
      [],
      schemaName
    )
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
    const nextReservation = reservations.rows.find((row: any) => row.property_id === property.id && row.check_in && new Date(row.check_in) >= now && !["cancelled", "removed_from_calendar"].includes(row.status));
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
  const monthStart = new Date(year, month, 1);
  const nextMonthStart = new Date(year, month + 1, 1);
  const activeReservations = reservations.rows.filter((row: any) => !["cancelled", "removed_from_calendar"].includes(row.status));
  const touristProperties = properties.rows.filter((row: any) => row.airbnb_enabled || row.operation_type === "tourist" || row.operation_type === "mixed" || row.type === "airbnb");
  const bookedNightsMonth = activeReservations.reduce((sum: number, row: any) => sum + overlapDays(new Date(row.check_in), new Date(row.check_out), monthStart, nextMonthStart), 0);
  const availableNightsMonth = touristProperties.length * Math.max(1, differenceInCalendarDays(nextMonthStart, monthStart));
  const upcomingReservations = activeReservations.filter((row: any) => new Date(row.check_in) >= now).slice(0, 5);
  const incomesMissingAmount = reservations.rows.filter((row: any) => row.income_amount_status === "missing" || row.income_amount === null || row.income_amount === undefined);

  return {
    kpis: {
      net_profit_month: monthIncome - monthExpenses,
      average_occupancy: availableNightsMonth > 0 ? Number(((bookedNightsMonth / availableNightsMonth) * 100).toFixed(1)) : 0,
      upcoming_expirations: alerts.length,
      accumulated_roi: investment > 0 ? (totalProfit / investment) * 100 : 0
    },
    properties: propertySummaries,
    alerts,
    upcoming_reservations: upcomingReservations,
    incomes_missing_amount: incomesMissingAmount,
    latest_movements: latestMovements,
    series
  };
}

function overlapDays(start: Date, end: Date, periodStart: Date, periodEnd: Date) {
  const overlapStart = start > periodStart ? start : periodStart;
  const overlapEnd = end < periodEnd ? end : periodEnd;
  return Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart));
}
