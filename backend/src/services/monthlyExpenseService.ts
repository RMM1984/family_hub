import { query } from "../config/db.js";
import { validateProperty } from "./crudService.js";

const monthlyCategories = ["electricity", "water", "internet", "cleaning", "repairs"] as const;
type MonthlyCategory = typeof monthlyCategories[number];

const labels: Record<MonthlyCategory, string> = {
  electricity: "Luz",
  water: "Agua",
  internet: "Internet",
  cleaning: "Limpieza",
  repairs: "Reparaciones"
};

export async function getMonthlyExpenses(schemaName: string, propertyId: string, monthInput: unknown) {
  await validateProperty(schemaName, propertyId);
  const month = normalizeMonth(monthInput);
  const result = await query(
    `select monthly_category, amount, id
     from expenses
     where property_id = $1
       and expense_month = $2::date
       and monthly_category = any($3::text[])
       and coalesce(is_demo,false) = false`,
    [propertyId, `${month}-01`, monthlyCategories],
    schemaName
  );
  const byCategory = new Map(result.rows.map((row: any) => [row.monthly_category, row]));
  const items = monthlyCategories.map((category) => ({
    id: byCategory.get(category)?.id ?? null,
    category,
    label: labels[category],
    amount: Number(byCategory.get(category)?.amount ?? 0)
  }));
  return { month, items, total: sumItems(items) };
}

export async function saveMonthlyExpenses(schemaName: string, propertyId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const month = normalizeMonth(input.month);
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const byCategory = new Map<string, unknown>();
  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const category = String((item as Record<string, unknown>).category ?? "");
    if (isMonthlyCategory(category)) byCategory.set(category, (item as Record<string, unknown>).amount);
  }
  for (const category of monthlyCategories) {
    const amount = normalizeAmount(byCategory.get(category));
    await query(
      `insert into expenses
        (property_id, category, provider, amount, expense_date, expense_month, monthly_category, description, data_origin, source_method, is_demo)
       values ($1,$2,$3,$4,$5::date,$5::date,$2,$6,'manual_monthly','manual',false)
       on conflict (property_id, expense_month, monthly_category) where monthly_category is not null
       do update set
        amount = excluded.amount,
        expense_date = excluded.expense_date,
        category = excluded.category,
        provider = excluded.provider,
        description = excluded.description,
        data_origin = excluded.data_origin,
        source_method = excluded.source_method,
        is_demo = false
       returning *`,
      [propertyId, category, labels[category], amount, `${month}-01`, `Gasto mensual ${labels[category]} ${month}`],
      schemaName
    );
  }
  return getMonthlyExpenses(schemaName, propertyId, month);
}

export async function getMonthlyStats(schemaName: string, propertyId: string, yearInput: unknown) {
  await validateProperty(schemaName, propertyId);
  const year = normalizeYear(yearInput);
  const income = await query(
    `select to_char(date_trunc('month', income_date::timestamp), 'YYYY-MM') as month,
            coalesce(sum(amount),0)::numeric as total
     from income
     where property_id = $1
       and income_date >= $2::date
       and income_date < ($2::date + interval '1 year')
       and amount is not null
       and coalesce(is_demo,false) = false
       and coalesce(amount_status, 'manual') <> 'missing'
     group by 1`,
    [propertyId, `${year}-01-01`],
    schemaName
  );
  const expenses = await query(
    `select to_char(date_trunc('month', coalesce(expense_month, expense_date)::timestamp), 'YYYY-MM') as month,
            coalesce(sum(amount),0)::numeric as total
     from expenses
     where property_id = $1
       and coalesce(expense_month, expense_date) >= $2::date
       and coalesce(expense_month, expense_date) < ($2::date + interval '1 year')
       and coalesce(is_demo,false) = false
     group by 1`,
    [propertyId, `${year}-01-01`],
    schemaName
  );
  const incomeByMonth = new Map(income.rows.map((row: any) => [row.month, Number(row.total ?? 0)]));
  const expenseByMonth = new Map(expenses.rows.map((row: any) => [row.month, Number(row.total ?? 0)]));
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const incomeTotal = Number(incomeByMonth.get(month) ?? 0);
    const expenseTotal = Number(expenseByMonth.get(month) ?? 0);
    return {
      month,
      income_total: incomeTotal,
      expense_total: expenseTotal,
      net_profit: incomeTotal - expenseTotal
    };
  });
  return { year, months };
}

function normalizeMonth(value: unknown) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeYear(value: unknown) {
  const parsed = Number(value);
  const now = new Date().getFullYear();
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) return parsed;
  return now;
}

function normalizeAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const amount = Number(String(value).replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function isMonthlyCategory(value: string): value is MonthlyCategory {
  return monthlyCategories.includes(value as MonthlyCategory);
}

function sumItems(items: Array<{ amount: number }>) {
  return items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
}
