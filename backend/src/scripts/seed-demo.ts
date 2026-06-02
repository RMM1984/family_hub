import bcrypt from "bcryptjs";
import { addDays, addMonths, format, subMonths } from "date-fns";
import { query } from "../config/db.js";
import { runMigrations } from "../db/migrate.js";

const schemaName = "tenant_familia_demo";
const slug = "familia-demo";

function date(value: Date) {
  return format(value, "yyyy-MM-dd");
}

async function upsertTenant() {
  await runMigrations(schemaName);
  const tenant = await query(
    `insert into public.tenants (name, slug, schema_name)
     values ('Familia Demo', $1, $2)
     on conflict (slug) do update set name = excluded.name
     returning *`,
    [slug, schemaName]
  );
  const passwordHash = await bcrypt.hash("Demo1234!", 12);
  await query(
    `insert into public.users (tenant_id, email, password_hash, full_name, role)
     values ($1, 'admin@familia-demo.com', $2, 'Administrador Demo', 'admin')
     on conflict (email) do update set password_hash = excluded.password_hash, active = true`,
    [tenant.rows[0].id, passwordHash]
  );
}

async function clearTenant() {
  await query("delete from document_history", [], schemaName);
  await query("delete from documents", [], schemaName);
  await query("delete from income", [], schemaName);
  await query("delete from expenses", [], schemaName);
  await query("delete from properties", [], schemaName);
}

async function createProperties() {
  const rows = [
    {
      alias: "Apartamento Centro",
      address: "Calle Mayor 12, Madrid",
      city: "Madrid",
      type: "airbnb",
      initial_investment: 180000,
      reform_cost: 25000,
      purchase_date: "2024-03-15",
      capacity_guests: 4,
      bedrooms: 2,
      bathrooms: 1,
      surface_m2: 75,
      airbnb_url: "https://www.airbnb.es/rooms/demo-centro",
      cover_image_url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop",
      notes: "Apartamento centrico totalmente reformado, alquiler turistico"
    },
    {
      alias: "Casa Pueblo",
      address: "Calle del Olivo 8, Javea",
      city: "Javea",
      type: "airbnb",
      initial_investment: 220000,
      reform_cost: 40000,
      purchase_date: "2023-08-20",
      capacity_guests: 6,
      bedrooms: 3,
      bathrooms: 2,
      surface_m2: 120,
      cover_image_url: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?q=80&w=1200&auto=format&fit=crop",
      notes: "Casa de pueblo con jardin, ideal vacaciones familiares"
    }
  ];
  const created = [];
  for (const row of rows) {
    const result = await query(
      `insert into properties (alias,address,city,type,initial_investment,reform_cost,purchase_date,capacity_guests,bedrooms,bathrooms,surface_m2,airbnb_url,cover_image_url,notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
      Object.values(row),
      schemaName
    );
    created.push(result.rows[0]);
  }
  return created as Array<{ id: string; alias: string }>;
}

async function seedExpenses(propertyId: string) {
  for (let month = 0; month < 12; month++) {
    await query(
      "insert into expenses (property_id, category, provider, amount, expense_date, description, is_recurring, recurrence) values ($1,'electricity','Iberdrola',$2,$3,'Factura mensual de luz',true,'monthly')",
      [propertyId, 60 + ((month * 13) % 60), date(subMonths(new Date(), month))],
      schemaName
    );
  }
  for (let month = 0; month < 4; month++) {
    await query(
      "insert into expenses (property_id, category, provider, amount, expense_date, description, is_recurring, recurrence) values ($1,'internet','Simyo',35,$2,'Internet vivienda',true,'monthly')",
      [propertyId, date(subMonths(new Date(), month * 3))],
      schemaName
    );
  }
  const fixed = [
    ["ibi", "Ayuntamiento", 350, "IBI anual"],
    ["garbage", "Ayuntamiento", 80, "Tasa de basuras"],
    ["cleaning", "Limpiezas Ana", 45, "Limpieza reserva"],
    ["cleaning", "Limpiezas Ana", 45, "Limpieza reserva"]
  ];
  for (const [index, row] of fixed.entries()) {
    await query(
      "insert into expenses (property_id, category, provider, amount, expense_date, description) values ($1,$2,$3,$4,$5,$6)",
      [propertyId, row[0], row[1], row[2], date(subMonths(new Date(), index + 1)), row[3]],
      schemaName
    );
  }
}

async function seedIncome(propertyId: string) {
  const names = ["Laura Martin", "Pablo Gomez", "Elena Ruiz", "Sofia Vidal", "Miguel Torres", "Clara Soler", "Ana Prieto", "Javier Cano", "Marta Gil", "Nuria Vega"];
  for (let i = 0; i < 10; i++) {
    const checkIn = addDays(subMonths(new Date(), 6), i * 17);
    const nights = 3 + (i % 12);
    const nightly = 85 + ((i * 19) % 95);
    await query(
      `insert into income (property_id, source, amount, income_date, description, guest_name, check_in, check_out, nights, airbnb_reservation_id, imported_from_ical)
       values ($1,'airbnb',$2,$3,'Reserva Airbnb',$4,$5,$6,$7,$8,false)`,
      [propertyId, nights * nightly, date(checkIn), names[i], date(checkIn), date(addDays(checkIn, nights)), nights, `demo-${propertyId}-${i}`],
      schemaName
    );
  }
}

async function seedDocuments(propertyId: string) {
  const today = new Date();
  const docs = [
    ["insurance", "hogar", "Seguro hogar", "Mapfre", 280, addDays(today, 45), "Poliza vivienda"],
    ["insurance", "rc", "Seguro RC", "AXA", 150, addDays(today, 200), "Responsabilidad civil"],
    ["license", "turistica", "Licencia turistica", "Ayuntamiento", 0, addMonths(today, 60), "Licencia activa"],
    ["certificate", "energetico", "Certificado energetico", "Tecnico certificado", 90, addDays(today, 30), "Renovar pronto"],
    ["inspection", "caldera", "Revision caldera anual", "Servicio tecnico", 75, addDays(today, 90), "Mantenimiento anual"],
    ["certificate", "habitabilidad", "Cedula habitabilidad", "Generalitat", 110, addMonths(today, 120), "Vigente"]
  ];
  for (const doc of docs) {
    const result = await query(
      `insert into documents (property_id,type,subtype,title,provider,cost,issue_date,expiration_date,notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [propertyId, doc[0], doc[1], doc[2], doc[3], doc[4], date(subMonths(today, 6)), date(doc[5] as Date), doc[6]],
      schemaName
    );
    await query("insert into document_history (document_id, year, cost, notes) values ($1,$2,$3,'Coste historico inicial')", [result.rows[0].id, today.getFullYear() - 1, Number(doc[4]) * 0.92], schemaName);
  }
}

async function main() {
  await upsertTenant();
  await clearTenant();
  const properties = await createProperties();
  for (const property of properties) {
    await seedExpenses(property.id);
    await seedIncome(property.id);
    await seedDocuments(property.id);
  }
  console.log("Seed demo completado: tenant familia-demo, 2 viviendas, gastos, ingresos y documentos.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
