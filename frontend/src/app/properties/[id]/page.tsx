"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, FileText, FolderSync, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createDriveFolder,
  createPropertyFinancing,
  createPropertyDocument,
  createPropertyExpense,
  createPropertyIncome,
  createReservationIncome,
  deleteDriveFolder,
  deletePropertyDocument,
  deletePropertyFinancing,
  disconnectPropertyAirbnb,
  disconnectPropertyDrive,
  applyAirbnbEarningsImport,
  getAvailableDriveFolders,
  getPropertyEssentialDocuments,
  getPropertyFinancing,
  getPropertyGroupedExpenses,
  getPropertyGroupedIncome,
  importAirbnbEarningsCsv,
  getPropertyAirbnbStats,
  getProperty,
  getPropertyDocuments,
  getPropertyDrive,
  getPropertyDriveAuthUrl,
  getPropertyExpenses,
  getPropertyIncome,
  getPropertyMonthlyExpenses,
  getPropertyMonthlyStats,
  getPropertyReservations,
  linkDriveFileDocument,
  linkDriveFileExpense,
  registerDriveFileDocument,
  registerDriveFileExpense,
  registerDriveFileIncome,
  registerDocumentExpense,
  registerDocumentIncome,
  savePropertyAirbnbIcal,
  savePropertyMonthlyExpenses,
  syncAllPropertyDrive,
  syncPropertyAirbnb,
  syncDriveFolder,
  syncPropertyDrive,
  updateDriveFile,
  updateDriveFolder,
  updatePropertyFinancing,
  updatePropertyDocument,
  updatePropertyIncome,
  updatePropertyOperation,
  updatePropertyReservation,
  updateReservationAmount,
  updateReservationGuestCount
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AirbnbEarningsImport, AirbnbStats, AvailableDriveFolder, DocumentItem, DriveFile, DriveFolderMapping, DriveState, Expense, FinancingPayment, GroupedFinance, GroupedFinancing, Income, MonthlyExpenseState, MonthlyProfitStats, Property, Reservation } from "@/types";

type Tab = "Resumen" | "Reservas" | "Contrato / Renta" | "Ingresos" | "Gastos" | "Documentos" | "Financiacion" | "Estadisticas";

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const propertyId = params.id;
  const queryClient = useQueryClient();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(requestedTab === "Drive" || requestedTab === "Documentos / Drive" || requestedTab === "Documentos" ? "Documentos" : requestedTab === "Reservas" ? "Reservas" : requestedTab === "Financiacion" ? "Financiacion" : "Resumen");
  const [showDemoData, setShowDemoData] = useState(false);
  const [incomeFilter, setIncomeFilter] = useState("todos");
  const [earningsImport, setEarningsImport] = useState<AirbnbEarningsImport | null>(null);
  const [expenseMonth, setExpenseMonth] = useState(currentMonthKey());
  const [financeYear, setFinanceYear] = useState(new Date().getFullYear());
  const { data: property } = useQuery<Property>({ queryKey: ["property", propertyId], queryFn: () => getProperty(propertyId) });
  const operationType = property?.operation_type ?? property?.rental_type ?? (property?.type === "airbnb" ? "tourist" : property?.type ?? "mixed");
  const showAirbnb = operationType === "tourist" || operationType === "mixed" || Boolean(property?.airbnb_enabled);
  const { data: income = [] } = useQuery<Income[]>({ queryKey: ["property-income", propertyId], queryFn: () => getPropertyIncome(propertyId) });
  const { data: groupedIncome } = useQuery<GroupedFinance<Income>>({ queryKey: ["property-grouped-income", propertyId, financeYear], queryFn: () => getPropertyGroupedIncome(propertyId, financeYear) });
  const { data: reservations = [] } = useQuery<Reservation[]>({ queryKey: ["property-reservations", propertyId], queryFn: () => getPropertyReservations(propertyId) });
  const { data: airbnbStats } = useQuery<AirbnbStats>({ queryKey: ["property-airbnb-stats", propertyId], queryFn: () => getPropertyAirbnbStats(propertyId), enabled: showAirbnb });
  const { data: expenses = [] } = useQuery<Expense[]>({ queryKey: ["property-expenses", propertyId], queryFn: () => getPropertyExpenses(propertyId) });
  const { data: groupedExpenses } = useQuery<GroupedFinance<Expense>>({ queryKey: ["property-grouped-expenses", propertyId, financeYear], queryFn: () => getPropertyGroupedExpenses(propertyId, financeYear) });
  const { data: monthlyExpenses } = useQuery<MonthlyExpenseState>({ queryKey: ["property-monthly-expenses", propertyId, expenseMonth], queryFn: () => getPropertyMonthlyExpenses(propertyId, expenseMonth) });
  const { data: monthlyStats } = useQuery<MonthlyProfitStats>({ queryKey: ["property-monthly-stats", propertyId, Number(expenseMonth.slice(0, 4))], queryFn: () => getPropertyMonthlyStats(propertyId, Number(expenseMonth.slice(0, 4))) });
  const { data: documents = [] } = useQuery<DocumentItem[]>({ queryKey: ["property-documents", propertyId], queryFn: () => getPropertyDocuments(propertyId) });
  const activeDocuments = useMemo(() => documents.filter((document) => !document.deleted_at), [documents]);
  const { data: groupedDocuments } = useQuery<GroupedFinance<DocumentItem>>({ queryKey: ["property-essential-documents", propertyId, financeYear], queryFn: () => getPropertyEssentialDocuments(propertyId, financeYear) });
  const { data: financing } = useQuery<GroupedFinancing>({ queryKey: ["property-financing", propertyId, financeYear], queryFn: () => getPropertyFinancing(propertyId, financeYear) });
  const { data: drive } = useQuery<DriveState>({ queryKey: ["property-drive", propertyId], queryFn: () => getPropertyDrive(propertyId) });
  const {
    data: availableDriveFolders = [],
    refetch: refetchAvailableDriveFolders,
    isFetching: loadingAvailableDriveFolders,
    error: availableDriveFoldersError
  } = useQuery<AvailableDriveFolder[]>({
    queryKey: ["property-drive-available-folders", propertyId, drive?.google_connected],
    queryFn: () => getAvailableDriveFolders(propertyId),
    enabled: Boolean(drive?.google_connected),
    retry: false
  });
  const totals = useMemo(() => {
    const realIncome = income.filter((item) => !item.is_demo);
    const totalIncome = realIncome.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    return { totalIncome, totalExpenses, profit: totalIncome - totalExpenses };
  }, [income, expenses]);
  const profitabilityStats = useMemo(() => {
    const realIncome = income.filter((item) => !item.is_demo && item.amount_status !== "missing" && item.amount !== null && item.amount !== undefined);
    const totalIncome = realIncome.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const paidNights = realIncome.reduce((sum, item) => sum + Number(item.nights ?? 0), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const ordinaryExpenses = activeDocuments
      .filter((document) => !document.is_demo && (document.document_category ?? "essential") === "essential" && document.status !== "ignored")
      .reduce((sum, document) => sum + Number(document.amount ?? document.cost ?? 0), 0);
    const financingItems = financing?.months.flatMap((month) => month.items) ?? [];
    const financingInterest = financingItems.reduce((sum, item) => sum + Number(item.interest_amount ?? 0), 0);
    const financingPrincipal = financingItems.reduce((sum, item) => sum + Number(item.principal_amount ?? 0), 0);
    const financingTotal = financingItems.reduce((sum, item) => sum + Number(item.total_payment ?? 0), 0);
    const categoryTotals = expenses.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + Number(item.amount ?? 0);
      return acc;
    }, {});
    const sumCategories = (keys: string[]) => keys.reduce((sum, key) => sum + Number(categoryTotals[key] ?? 0), 0);
    const guestCounts = reservations
      .filter((reservation) => !reservation.is_demo && reservation.guest_count !== null && reservation.guest_count !== undefined)
      .map((reservation) => Number(reservation.guest_count));
    const guestFrequency = guestCounts.reduce<Record<number, number>>((acc, count) => {
      acc[count] = (acc[count] ?? 0) + 1;
      return acc;
    }, {});
    const mostRepeatedGuests = Object.entries(guestFrequency)
      .sort((a, b) => Number(b[1]) - Number(a[1]) || Number(a[0]) - Number(b[0]))[0];
    const investmentBase = Number(property?.initial_investment ?? 0) + Number(property?.reform_cost ?? 0);
    const net = totalIncome - totalExpenses - ordinaryExpenses;
    return {
      totalIncome,
      totalExpenses,
      net,
      averageIncomePerNight: paidNights > 0 ? totalIncome / paidNights : null,
      paidNights,
      mostRepeatedGuests: mostRepeatedGuests ? Number(mostRepeatedGuests[0]) : null,
      mostRepeatedGuestsFrequency: mostRepeatedGuests ? Number(mostRepeatedGuests[1]) : 0,
      averageGuests: guestCounts.length > 0 ? guestCounts.reduce((sum, count) => sum + count, 0) / guestCounts.length : null,
      profitabilityPercent: totalIncome > 0 ? (net / totalIncome) * 100 : null,
      roiPercent: investmentBase > 0 ? (net / investmentBase) * 100 : null,
      operationalExpenses: sumCategories(["electricity", "water", "gas", "internet"]),
      cleaningSuppliesSupermarket: sumCategories(["cleaning", "supplies", "supermarket"]),
      ordinaryExpenses,
      financingExpenses: financingInterest,
      financingPrincipal,
      financingTotal,
      repairsExpenses: sumCategories(["maintenance", "repairs"]),
      categoryTotals
    };
  }, [income, expenses, activeDocuments, financing, reservations, property?.initial_investment, property?.reform_cost]);
  const tabs: Tab[] = showAirbnb
    ? ["Resumen", "Reservas", "Ingresos", "Gastos", "Documentos", "Financiacion", "Estadisticas"]
    : ["Resumen", "Contrato / Renta", "Ingresos", "Gastos", "Documentos", "Financiacion", "Estadisticas"];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-income", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-grouped-income", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-reservations", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-airbnb-stats", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-expenses", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-grouped-expenses", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-monthly-expenses", propertyId, expenseMonth] });
    queryClient.invalidateQueries({ queryKey: ["property-monthly-stats", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-grouped-documents", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-essential-documents", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["property-financing", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["properties"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const expenseMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createPropertyExpense(propertyId, data), onSuccess: refresh });
  const monthlyExpenseMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => savePropertyMonthlyExpenses(propertyId, data), onSuccess: refresh });
  const incomeMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createPropertyIncome(propertyId, data), onSuccess: refresh });
  const incomeUpdateMutation = useMutation({ mutationFn: ({ incomeId, data }: { incomeId: string; data: Record<string, unknown> }) => updatePropertyIncome(propertyId, incomeId, data), onSuccess: refresh });
  const propertyOperationMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => updatePropertyOperation(propertyId, data), onSuccess: refresh });
  const airbnbIcalMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => savePropertyAirbnbIcal(propertyId, data), onSuccess: refresh });
  const airbnbSyncMutation = useMutation({ mutationFn: () => syncPropertyAirbnb(propertyId), onSuccess: refresh });
  const airbnbDisconnectMutation = useMutation({ mutationFn: () => disconnectPropertyAirbnb(propertyId), onSuccess: refresh });
  const airbnbEarningsImportMutation = useMutation({
    mutationFn: (file: File) => importAirbnbEarningsCsv(propertyId, file),
    onSuccess: (data: AirbnbEarningsImport) => {
      setEarningsImport(data);
      refresh();
    }
  });
  const airbnbEarningsApplyMutation = useMutation({
    mutationFn: (importId: string) => applyAirbnbEarningsImport(propertyId, importId, { apply_all_safe: true }),
    onSuccess: (data: AirbnbEarningsImport) => {
      setEarningsImport(data);
      refresh();
    }
  });
  const reservationIncomeMutation = useMutation({ mutationFn: ({ reservationId, data }: { reservationId: string; data: Record<string, unknown> }) => createReservationIncome(propertyId, reservationId, data), onSuccess: refresh });
  const reservationAmountMutation = useMutation({ mutationFn: ({ reservationId, data }: { reservationId: string; data: Record<string, unknown> }) => updateReservationAmount(propertyId, reservationId, data), onSuccess: refresh });
  const reservationGuestCountMutation = useMutation({ mutationFn: ({ reservationId, data }: { reservationId: string; data: Record<string, unknown> }) => updateReservationGuestCount(propertyId, reservationId, data), onSuccess: refresh });
  const reservationUpdateMutation = useMutation({ mutationFn: ({ reservationId, data }: { reservationId: string; data: Record<string, unknown> }) => updatePropertyReservation(propertyId, reservationId, data), onSuccess: refresh });
  const documentMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createPropertyDocument(propertyId, data), onSuccess: refresh });
  const documentUpdateMutation = useMutation({ mutationFn: ({ documentId, data }: { documentId: string; data: Record<string, unknown> }) => updatePropertyDocument(propertyId, documentId, data), onSuccess: refresh });
  const documentDeleteMutation = useMutation({ mutationFn: (documentId: string) => deletePropertyDocument(propertyId, documentId), onSuccess: refresh });
  const financingMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createPropertyFinancing(propertyId, data), onSuccess: refresh });
  const financingUpdateMutation = useMutation({ mutationFn: ({ paymentId, data }: { paymentId: string; data: Record<string, unknown> }) => updatePropertyFinancing(propertyId, paymentId, data), onSuccess: refresh });
  const financingDeleteMutation = useMutation({ mutationFn: (paymentId: string) => deletePropertyFinancing(propertyId, paymentId), onSuccess: refresh });
  const documentExpenseMutation = useMutation({ mutationFn: (documentId: string) => registerDocumentExpense(propertyId, documentId, {}), onSuccess: refresh });
  const documentIncomeMutation = useMutation({ mutationFn: (documentId: string) => registerDocumentIncome(propertyId, documentId, {}), onSuccess: refresh });
  const refreshDrive = () => queryClient.invalidateQueries({ queryKey: ["property-drive", propertyId] });
  const driveAuthorizeMutation = useMutation({
    mutationFn: () => getPropertyDriveAuthUrl(propertyId),
    onSuccess: (data) => {
      window.location.href = data.url;
    }
  });
  const driveFolderCreateMutation = useMutation({ mutationFn: (data: Record<string, unknown>) => createDriveFolder(propertyId, data), onSuccess: refreshDrive });
  const driveFolderUpdateMutation = useMutation({ mutationFn: ({ folderId, data }: { folderId: string; data: Record<string, unknown> }) => updateDriveFolder(propertyId, folderId, data), onSuccess: refreshDrive });
  const driveFolderDeleteMutation = useMutation({ mutationFn: (folderId: string) => deleteDriveFolder(propertyId, folderId), onSuccess: refreshDrive });
  const driveSyncMutation = useMutation({ mutationFn: () => syncPropertyDrive(propertyId), onSuccess: refreshDrive });
  const driveSyncAllMutation = useMutation({ mutationFn: () => syncAllPropertyDrive(propertyId), onSuccess: refreshDrive });
  const driveFolderSyncMutation = useMutation({ mutationFn: (folderId: string) => syncDriveFolder(propertyId, folderId), onSuccess: refreshDrive });
  const driveUpdateMutation = useMutation({ mutationFn: ({ fileId, data }: { fileId: string; data: Record<string, unknown> }) => updateDriveFile(propertyId, fileId, data), onSuccess: refreshDrive });
  const driveLinkExpenseMutation = useMutation({ mutationFn: ({ fileId, expenseId }: { fileId: string; expenseId: string }) => linkDriveFileExpense(propertyId, fileId, expenseId), onSuccess: refreshDrive });
  const driveLinkDocumentMutation = useMutation({ mutationFn: ({ fileId, documentId }: { fileId: string; documentId: string }) => linkDriveFileDocument(propertyId, fileId, documentId), onSuccess: refreshDrive });
  const driveDisconnectMutation = useMutation({ mutationFn: () => disconnectPropertyDrive(propertyId), onSuccess: refreshDrive });
  const driveRegisterExpenseMutation = useMutation({
    mutationFn: ({ fileId, data }: { fileId: string; data: Record<string, unknown> }) => registerDriveFileExpense(propertyId, fileId, data),
    onSuccess: refresh
  });
  const driveRegisterDocumentMutation = useMutation({
    mutationFn: ({ fileId, data }: { fileId: string; data: Record<string, unknown> }) => registerDriveFileDocument(propertyId, fileId, data),
    onSuccess: refresh
  });
  const driveRegisterIncomeMutation = useMutation({
    mutationFn: ({ fileId, data }: { fileId: string; data: Record<string, unknown> }) => registerDriveFileIncome(propertyId, fileId, data),
    onSuccess: refresh
  });

  if (!property) return null;
  const visibleIncome = income
    .filter((item) => showDemoData || !item.is_demo)
    .filter((item) => {
      if (incomeFilter === "manuales") return item.source !== "airbnb";
      if (incomeFilter === "airbnb") return item.source === "airbnb";
      if (incomeFilter === "pending") return item.amount_status === "missing" || item.amount === null || item.amount === undefined;
      if (incomeFilter === "completed") return item.amount_status !== "missing" && item.amount !== null && item.amount !== undefined;
      return true;
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/properties" className="text-sm font-semibold text-meadow">Volver a viviendas</Link>
          <h2 className="mt-1 text-2xl font-bold">{property.alias}</h2>
          <p className="text-sm text-slate-500">{property.address}</p>
          <p className="mt-2 inline-flex rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{labelOperationType(operationType)}</p>
        </div>
        <OperationTypeControl value={operationType} airbnbEnabled={Boolean(property.airbnb_enabled)} pending={propertyOperationMutation.isPending} onChange={(data) => propertyOperationMutation.mutate(data)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`h-10 whitespace-nowrap rounded-md px-4 text-sm font-semibold ${tab === item ? "bg-ink text-white" : "bg-white text-slate-600"}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === "Resumen" && (
        <section className="grid gap-4 md:grid-cols-3">
          <Metric title="Ingresos" value={formatCurrency(totals.totalIncome)} icon={<Wallet className="h-5 w-5" />} />
          <Metric title="Gastos" value={formatCurrency(totals.totalExpenses)} icon={<Receipt className="h-5 w-5" />} />
          <Metric title="Beneficio" value={formatCurrency(totals.profit)} icon={<CalendarClock className="h-5 w-5" />} />
        </section>
      )}

      {tab === "Reservas" && showAirbnb && (
        <ReservationsPanel
          property={property}
          reservations={reservations}
          stats={airbnbStats}
          earningsImport={earningsImport}
          pendingSave={airbnbIcalMutation.isPending}
          pendingSync={airbnbSyncMutation.isPending}
          pendingIncome={reservationIncomeMutation.isPending || reservationAmountMutation.isPending || reservationGuestCountMutation.isPending || airbnbEarningsApplyMutation.isPending}
          pendingEarningsImport={airbnbEarningsImportMutation.isPending}
          pendingEarningsApply={airbnbEarningsApplyMutation.isPending}
          onSaveIcal={(data) => airbnbIcalMutation.mutate(data)}
          onSync={() => airbnbSyncMutation.mutate()}
          onDisconnect={() => airbnbDisconnectMutation.mutate()}
          onImportEarnings={(file) => airbnbEarningsImportMutation.mutate(file)}
          onApplyEarnings={(importId) => airbnbEarningsApplyMutation.mutate(importId)}
          onCreateIncome={(reservationId, data) => reservationIncomeMutation.mutate({ reservationId, data })}
          onUpdateAmount={(reservationId, data) => reservationAmountMutation.mutate({ reservationId, data })}
          onUpdateGuestCount={(reservationId, data) => reservationGuestCountMutation.mutate({ reservationId, data })}
          onUpdateReservation={(reservationId, data) => reservationUpdateMutation.mutate({ reservationId, data })}
        />
      )}

      {tab === "Contrato / Renta" && !showAirbnb && (
        <Card className="p-5">
          <h3 className="font-bold">Contrato / Renta</h3>
          <p className="mt-2 text-sm text-slate-500">Vivienda de larga estancia. Gestiona ingresos, gastos y documentos desde las pestañas de esta vivienda.</p>
        </Card>
      )}

      {tab === "Ingresos" && (
        <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <IncomeForm pending={incomeMutation.isPending} onSubmit={(data) => incomeMutation.mutate(data)} />
          <section className="space-y-3">
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  ["todos", "Todos"],
                  ["manuales", "Manuales"],
                  ["airbnb", "Airbnb"],
                  ["pending", "Pendientes de importe"],
                  ["completed", "Con importe"]
                ].map(([value, label]) => (
                  <button key={value} onClick={() => setIncomeFilter(value)} className={`rounded-md px-3 py-2 text-sm font-semibold ${incomeFilter === value ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>
                ))}
                <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={showDemoData} onChange={(event) => setShowDemoData(event.target.checked)} />
                  Mostrar datos demo
                </label>
                <YearSelector year={financeYear} onChange={setFinanceYear} />
              </div>
            </Card>
            <GroupedIncomeView
              data={groupedIncome}
              filter={incomeFilter}
              pending={incomeUpdateMutation.isPending}
              onUpdate={(incomeId, data) => incomeUpdateMutation.mutate({ incomeId, data })}
            />
          </section>
        </section>
      )}

      {tab === "Gastos" && (
        <section className="space-y-5">
          <MonthlyExpensesPanel
            month={expenseMonth}
            data={monthlyExpenses}
            pending={monthlyExpenseMutation.isPending}
            onMonthChange={setExpenseMonth}
            onSubmit={(data) => monthlyExpenseMutation.mutate(data)}
          />
          <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <ExpenseForm pending={expenseMutation.isPending} onSubmit={(data) => expenseMutation.mutate(data)} />
            <section className="space-y-3">
              <Card className="p-4">
                <YearSelector year={financeYear} onChange={setFinanceYear} />
              </Card>
              <GroupedExpenseView data={groupedExpenses} />
            </section>
          </section>
        </section>
      )}

      {tab === "Documentos" && (
        <section className="space-y-5">
          <div>
            <h3 className="font-bold">Documentos esenciales</h3>
            <p className="text-sm text-slate-500">IBI, seguros, basuras, certificados, cedula y licencia turistica se gestionan aqui, separados de gastos operativos.</p>
          </div>
          <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <DocumentForm pending={documentMutation.isPending} onSubmit={(data) => documentMutation.mutate(data)} />
            <section className="space-y-3">
              <Card className="p-4">
                <YearSelector year={financeYear} onChange={setFinanceYear} />
              </Card>
              <GroupedDocumentView
                data={groupedDocuments}
                pending={documentUpdateMutation.isPending || documentDeleteMutation.isPending}
                onUpdate={(documentId, data) => documentUpdateMutation.mutate({ documentId, data })}
                onDelete={(documentId) => documentDeleteMutation.mutate(documentId)}
              />
            </section>
          </section>
          {drive && (
            <section className="space-y-3">
              <div>
                <h3 className="font-bold">Bandeja Drive</h3>
                <p className="text-sm text-slate-500">Revisa archivos nuevos de Drive y clasificalos como gasto operativo o documento esencial.</p>
              </div>
            <DrivePanel
              drive={drive}
              availableDriveFolders={availableDriveFolders}
              availableDriveFoldersError={availableDriveFoldersError}
              loadingAvailableDriveFolders={loadingAvailableDriveFolders}
              googleStatus={searchParams.get("google")}
              expenses={expenses}
              documents={activeDocuments}
              pendingConnect={driveFolderCreateMutation.isPending}
              pendingAuthorize={driveAuthorizeMutation.isPending}
              pendingSync={driveSyncMutation.isPending || driveSyncAllMutation.isPending || driveFolderSyncMutation.isPending}
              pendingUpdate={driveUpdateMutation.isPending || driveLinkExpenseMutation.isPending || driveLinkDocumentMutation.isPending || driveRegisterExpenseMutation.isPending || driveRegisterDocumentMutation.isPending || driveRegisterIncomeMutation.isPending || driveDisconnectMutation.isPending}
              onAuthorize={() => driveAuthorizeMutation.mutate()}
              onLoadFolders={() => refetchAvailableDriveFolders()}
              onDisconnect={() => driveDisconnectMutation.mutate()}
              onCreateFolder={(data) => driveFolderCreateMutation.mutate(data)}
              onUpdateFolder={(folderId, data) => driveFolderUpdateMutation.mutate({ folderId, data })}
              onDeleteFolder={(folderId) => driveFolderDeleteMutation.mutate(folderId)}
              onSyncFolder={(folderId) => driveFolderSyncMutation.mutate(folderId)}
              onSyncAll={() => driveSyncAllMutation.mutate()}
              onSync={() => driveSyncMutation.mutate()}
              onUpdate={(fileId, data) => driveUpdateMutation.mutate({ fileId, data })}
              onLinkExpense={(fileId, expenseId) => driveLinkExpenseMutation.mutate({ fileId, expenseId })}
              onLinkDocument={(fileId, documentId) => driveLinkDocumentMutation.mutate({ fileId, documentId })}
              onRegisterExpense={(fileId, data) => driveRegisterExpenseMutation.mutate({ fileId, data })}
              onSaveDocument={(fileId, data) => driveRegisterDocumentMutation.mutate({ fileId, data })}
              onRegisterIncome={(fileId, data) => driveRegisterIncomeMutation.mutate({ fileId, data })}
            />
            </section>
          )}
        </section>
      )}

      {tab === "Financiacion" && (
        <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <FinancingForm pending={financingMutation.isPending} documents={activeDocuments.filter((document) => document.document_category !== "operational_receipt")} onSubmit={(data) => financingMutation.mutate(data)} />
          <section className="space-y-3">
            <Card className="p-4">
              <YearSelector year={financeYear} onChange={setFinanceYear} />
            </Card>
            <GroupedFinancingView
              data={financing}
              pending={financingUpdateMutation.isPending || financingDeleteMutation.isPending}
              documents={activeDocuments}
              onUpdate={(paymentId, data) => financingUpdateMutation.mutate({ paymentId, data })}
              onDelete={(paymentId) => financingDeleteMutation.mutate(paymentId)}
            />
          </section>
        </section>
      )}

      {tab === "Estadisticas" && (
        <section className="space-y-5">
          <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            <Metric title="Ingreso medio/noche" value={profitabilityStats.averageIncomePerNight === null ? "-" : formatCurrency(profitabilityStats.averageIncomePerNight)} icon={<CalendarClock className="h-5 w-5" />} />
            <Metric title="Huespedes frecuentes" value={profitabilityStats.mostRepeatedGuests === null ? "-" : `${profitabilityStats.mostRepeatedGuests} (${formatNumber(profitabilityStats.averageGuests)})`} icon={<Plus className="h-5 w-5" />} />
            <Metric title="Ingresos totales" value={formatCurrency(profitabilityStats.totalIncome)} icon={<Wallet className="h-5 w-5" />} />
            <Metric title="Gastos totales" value={formatCurrency(profitabilityStats.totalExpenses)} icon={<Receipt className="h-5 w-5" />} />
            <Metric title="Rentabilidad" value={formatPercent(profitabilityStats.profitabilityPercent)} icon={<Wallet className="h-5 w-5" />} />
            <Metric title="Beneficio neto" value={formatCurrency(profitabilityStats.net)} icon={<Wallet className="h-5 w-5" />} />
            <Metric title="ROI inversion" value={formatPercent(profitabilityStats.roiPercent)} icon={<Wallet className="h-5 w-5" />} />
            <Metric title="Noches con importe" value={String(profitabilityStats.paidNights)} icon={<CalendarClock className="h-5 w-5" />} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ExpenseStat title="Gastos operativos" subtitle="Luz, agua, gas e internet" amount={profitabilityStats.operationalExpenses} />
            <ExpenseStat title="Limpieza y compras" subtitle="Limpieza, utiles y supermercado" amount={profitabilityStats.cleaningSuppliesSupermarket} />
            <ExpenseStat title="Costes ordinarios" subtitle="IBI, basuras, seguros, certificados y licencias" amount={profitabilityStats.ordinaryExpenses} />
            <ExpenseStat title="Financiacion - intereses" subtitle="Coste financiero de hipoteca" amount={profitabilityStats.financingExpenses} />
            <ExpenseStat title="Financiacion - amortizacion" subtitle="Capital amortizado, separado del gasto" amount={profitabilityStats.financingPrincipal} />
            <ExpenseStat title="Cashflow tras financiacion" subtitle="Beneficio operativo menos cuota total" amount={profitabilityStats.net - profitabilityStats.financingTotal} />
            <ExpenseStat title="Reparaciones" subtitle="Mantenimiento y reparaciones" amount={profitabilityStats.repairsExpenses} />
            <ExpenseStat title="Documentos activos" subtitle="Documentos registrados en esta vivienda" amount={activeDocuments.length} plain />
          </section>

          <MonthlyProfitPanel stats={monthlyStats} />

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Desglose por categoria</h3>
                <p className="text-sm text-slate-500">Base actual de gastos registrados para esta vivienda.</p>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {Object.entries(profitabilityStats.categoryTotals).map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                  <p className="font-semibold">{labelExpenseCategory(category)}</p>
                  <p className="font-bold">{formatCurrency(amount)}</p>
                </div>
              ))}
              {Object.keys(profitabilityStats.categoryTotals).length === 0 && <p className="text-sm text-slate-500">No hay gastos registrados.</p>}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
function DrivePanel({
  drive,
  availableDriveFolders,
  availableDriveFoldersError,
  loadingAvailableDriveFolders,
  googleStatus,
  expenses,
  documents,
  pendingConnect,
  pendingAuthorize,
  pendingSync,
  pendingUpdate,
  onAuthorize,
  onLoadFolders,
  onDisconnect,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onSyncFolder,
  onSyncAll,
  onSync,
  onUpdate,
  onLinkExpense,
  onLinkDocument,
  onRegisterExpense,
  onSaveDocument,
  onRegisterIncome
}: {
  drive: DriveState;
  availableDriveFolders: AvailableDriveFolder[];
  availableDriveFoldersError: unknown;
  loadingAvailableDriveFolders: boolean;
  googleStatus: string | null;
  expenses: Expense[];
  documents: DocumentItem[];
  pendingConnect: boolean;
  pendingAuthorize: boolean;
  pendingSync: boolean;
  pendingUpdate: boolean;
  onAuthorize: () => void;
  onLoadFolders: () => void;
  onDisconnect: () => void;
  onCreateFolder: (data: Record<string, unknown>) => void;
  onUpdateFolder: (folderId: string, data: Record<string, unknown>) => void;
  onDeleteFolder: (folderId: string) => void;
  onSyncFolder: (folderId: string) => void;
  onSyncAll: () => void;
  onSync: () => void;
  onUpdate: (fileId: string, data: Record<string, unknown>) => void;
  onLinkExpense: (fileId: string, expenseId: string) => void;
  onLinkDocument: (fileId: string, documentId: string) => void;
  onRegisterExpense: (fileId: string, data: Record<string, unknown>) => void;
  onSaveDocument: (fileId: string, data: Record<string, unknown>) => void;
  onRegisterIncome: (fileId: string, data: Record<string, unknown>) => void;
}) {
  const [filter, setFilter] = useState("pending_review");
  const [folderFilter, setFolderFilter] = useState("todos");
  const filtered = drive.files.filter((file) => {
    if (folderFilter !== "todos" && file.drive_folder_mapping_id !== folderFilter) return false;
    if (filter === "todos") return true;
    if (filter === "registered") return ["registered","linked","registered_document","registered_expense","registered_income"].includes(String(file.review_status));
    if (["pending_review", "reviewed", "linked", "registered_document", "registered_expense", "registered_income", "ignored"].includes(filter)) return file.review_status === filter;
    return true;
  });
  const counts = drive.files.reduce<Record<string, number>>((acc, file) => {
    const status = file.review_status ?? "pending_review";
    acc[status] = (acc[status] ?? 0) + 1;
    acc.todos = (acc.todos ?? 0) + 1;
    acc.registered = (acc.registered ?? 0) + (["registered","linked","registered_document","registered_expense","registered_income"].includes(status) ? 1 : 0);
    return acc;
  }, { todos: 0 });

  return (
    <section className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Google Drive</h3>
            <p className="text-sm text-slate-500">Bandeja mensual para revisar facturas y documentos de esta vivienda.</p>
            <p className={`mt-2 inline-flex rounded-md px-3 py-1 text-sm font-semibold ${drive.google_connected ? "bg-emerald-50 text-meadow" : "bg-slate-100 text-slate-600"}`}>
              {drive.google_connected ? "Conectado a Google Drive" : "Google Drive pendiente de autorizar"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {drive.google_configured && !drive.google_connected && (
              <Button disabled={pendingAuthorize} onClick={onAuthorize} className="bg-ink">
                <ExternalLink className="h-4 w-4" />
                Autorizar Google
              </Button>
            )}
            {drive.google_connected && (
              <Button disabled={pendingUpdate} onClick={onDisconnect} className="bg-white text-coral hover:bg-slate-50">
                Desconectar
              </Button>
            )}
            <Button disabled={drive.folders.length === 0 || pendingSync} onClick={onSyncAll} className="bg-meadow hover:bg-green-700">
              <FolderSync className="h-4 w-4" />
              Sincronizar carpetas
            </Button>
          </div>
        </div>
        {googleStatus === "connected" && (
          <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-meadow">Google Drive conectado correctamente.</p>
        )}
        {!drive.google_configured && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-sun">Google Drive no esta configurado en Railway. Puedes preparar carpetas manuales; la sincronizacion real requiere OAuth y token autorizado.</p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-bold">Conectar carpeta real de Drive</h3>
        <DriveConnectForm
          folders={availableDriveFolders}
          googleConnected={Boolean(drive.google_connected)}
          pending={pendingConnect}
          loadingFolders={loadingAvailableDriveFolders}
          folderError={availableDriveFoldersError}
          onLoadFolders={onLoadFolders}
          onSubmit={onCreateFolder}
        />
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-bold">Carpetas conectadas</h3>
        <div className="grid gap-3">
          {drive.folders.map((folder) => (
            <DriveFolderCard key={folder.id} folder={folder} pending={pendingSync} onSync={onSyncFolder} onUpdate={onUpdateFolder} onDelete={onDeleteFolder} />
          ))}
          {drive.folders.length === 0 && <p className="text-sm text-slate-500">Todavia no has conectado ninguna carpeta de Drive para esta vivienda.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Bandeja de revisión</h3>
            <p className="text-sm text-slate-500">Revisa archivos nuevos y conviertelos en documento esencial, gasto o ingreso.</p>
          </div>
          <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            <option value="todos">Todas las carpetas</option>
            {drive.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.drive_folder_name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {["pending_review", "registered_document", "registered_expense", "registered_income", "ignored", "todos"].map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={`rounded-md px-3 py-2 text-sm font-semibold ${filter === item ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>
              {labelDriveFilter(item)} ({counts[item] ?? 0})
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3">
        {filtered.map((file) => (
          <DriveFileCard
            key={file.id}
            file={file}
            expenses={expenses}
            documents={documents}
            pending={pendingUpdate}
            onUpdate={onUpdate}
            onLinkExpense={onLinkExpense}
            onLinkDocument={onLinkDocument}
            onRegisterExpense={onRegisterExpense}
            onSaveDocument={onSaveDocument}
            onRegisterIncome={onRegisterIncome}
          />
        ))}
        {filtered.length === 0 && <Card className="p-5 text-sm text-slate-500">No hay archivos para este filtro.</Card>}
      </div>
    </section>
  );
}

function OperationTypeControl({ value, airbnbEnabled, pending, onChange }: { value: string; airbnbEnabled: boolean; pending: boolean; onChange: (data: Record<string, unknown>) => void }) {
  const [operationType, setOperationType] = useState(value);
  const [enabled, setEnabled] = useState(airbnbEnabled);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Tipo de operacion</span>
        <select value={operationType} onChange={(event) => setOperationType(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
          {["tourist", "long_term", "own_use", "mixed", "inactive"].map((item) => <option key={item} value={item}>{labelOperationType(item)}</option>)}
        </select>
      </label>
      <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Airbnb
      </label>
      <Button disabled={pending} onClick={() => onChange({ operation_type: operationType, airbnb_enabled: enabled })} className="bg-ink">Guardar</Button>
    </div>
  );
}

function MonthlyExpensesPanel({
  month,
  data,
  pending,
  onMonthChange,
  onSubmit
}: {
  month: string;
  data?: MonthlyExpenseState;
  pending: boolean;
  onMonthChange: (month: string) => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  useEffect(() => {
    const next = Object.fromEntries((data?.items ?? monthlyExpenseDefaults()).map((item) => [item.category, String(item.amount || "")]));
    setAmounts(next);
  }, [data, month]);
  const items = data?.items ?? monthlyExpenseDefaults();
  const total = items.reduce((sum, item) => sum + Number(amounts[item.category] || 0), 0);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      month,
      items: items.map((item) => ({ category: item.category, amount: Number(String(amounts[item.category] || "0").replace(",", ".")) || 0 }))
    });
  }
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-bold">Gastos de {formatMonthLabel(month)}</h3>
          <p className="text-sm text-slate-500">Introduce gastos mensuales rápidos por vivienda.</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Mes</span>
          <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3" />
        </label>
      </div>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {items.map((item) => (
            <label key={item.category} className="block">
              <span className="mb-1 block text-sm font-medium">{item.label}</span>
              <input
                value={amounts[item.category] ?? ""}
                onChange={(event) => setAmounts((current) => ({ ...current, [item.category]: event.target.value }))}
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow"
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-600">Total del mes</p>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
          <Button disabled={pending} className="bg-ink">Guardar gastos del mes</Button>
        </div>
      </form>
    </Card>
  );
}

function YearSelector({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
      Año
      <input type="number" min="2000" max="2100" value={year} onChange={(event) => onChange(Number(event.target.value) || new Date().getFullYear())} className="h-10 w-28 rounded-md border border-slate-300 px-3" />
    </label>
  );
}

function GroupedIncomeView({
  data,
  filter,
  pending,
  onUpdate
}: {
  data?: GroupedFinance<Income>;
  filter: string;
  pending: boolean;
  onUpdate: (incomeId: string, data: Record<string, unknown>) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const months = (data?.months ?? []).map((month) => ({ ...month, items: month.items.filter((item) => filterIncome(item, filter)) })).filter((month) => month.items.length > 0);
  return (
    <section className="space-y-3">
      <p className="text-sm font-semibold text-slate-500">{data?.year ?? ""}</p>
      {months.map((month) => {
        const total = month.items.filter((item) => item.amount_status !== "missing" && item.amount !== null && item.amount !== undefined).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
        return (
          <Card key={month.month} className="overflow-hidden">
            <MonthHeader label={month.label} totalLabel="Total ingresos" total={total} />
            {month.items.map((item) => (
              <IncomeRow
                key={item.id}
                item={item}
                editing={editingId === item.id}
                pending={pending}
                onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
                onCancel={() => setEditingId(null)}
                onUpdate={(data) => {
                  onUpdate(item.id, data);
                  setEditingId(null);
                }}
              />
            ))}
          </Card>
        );
      })}
      {months.length === 0 && <Card className="p-5 text-sm text-slate-500">No hay ingresos para este año/filtro.</Card>}
    </section>
  );
}

function GroupedExpenseView({ data }: { data?: GroupedFinance<Expense> }) {
  const months = (data?.months ?? []).filter((month) => month.items.length > 0);
  return (
    <section className="space-y-3">
      <p className="text-sm font-semibold text-slate-500">{data?.year ?? ""}</p>
      {months.map((month) => (
        <Card key={month.month} className="overflow-hidden">
          <MonthHeader label={month.label} totalLabel="Total gastos" total={Number(month.expense_total ?? 0)} />
          {month.items.map((item) => (
            <Row key={item.id} title={item.provider ?? labelExpenseCategory(item.category)} subtitle={`${item.description ?? "Gasto"} · ${formatDate(item.expense_date)}`} amount={item.amount} />
          ))}
        </Card>
      ))}
      {months.length === 0 && <Card className="p-5 text-sm text-slate-500">No hay gastos para este año.</Card>}
    </section>
  );
}

function GroupedDocumentView({
  data,
  pending,
  onUpdate,
  onDelete
}: {
  data?: GroupedFinance<DocumentItem>;
  pending: boolean;
  onUpdate: (documentId: string, data: Record<string, unknown>) => void;
  onDelete: (documentId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const months = (data?.months ?? []).filter((month) => month.items.length > 0);
  return (
    <section className="space-y-3">
      <p className="text-sm font-semibold text-slate-500">{data?.year ?? ""}</p>
      {months.map((month) => (
        <Card key={month.month} className="overflow-hidden">
          <MonthHeader label={month.label} totalLabel="Total documental" total={Number(month.document_total ?? 0)} />
          {month.items.map((item) => (
            <div key={item.id} className="border-b border-slate-200 p-4 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-slate-500">{labelDocumentType(item.document_type ?? item.type)} · Fecha documento: {formatDate(item.document_date)} · Vigencia: {formatDate(item.valid_until ?? item.expiration_date)} · Organismo: {item.provider ?? "-"} · {labelDocumentStatus(item.status)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{formatCurrency(item.amount ?? item.cost)}</p>
                  <Button disabled={pending} onClick={() => setEditingId(editingId === item.id ? null : item.id)} className="bg-white text-ink hover:bg-slate-50">
                    {editingId === item.id ? "Cancelar" : "Editar"}
                  </Button>
                  <Button disabled={pending} onClick={() => window.confirm("Eliminar de Hogarflow? No se borrara el archivo de Drive.") && onDelete(item.id)} className="bg-white text-red-700 hover:bg-red-50">Eliminar de Hogarflow</Button>
                </div>
              </div>
              {editingId === item.id && (
                <DocumentEditForm
                  item={item}
                  pending={pending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(data) => {
                    onUpdate(item.id, data);
                    setEditingId(null);
                  }}
                />
              )}
            </div>
          ))}
        </Card>
      ))}
      {months.length === 0 && <Card className="p-5 text-sm text-slate-500">No hay documentos para este año.</Card>}
    </section>
  );
}

function MonthHeader({ label, totalLabel, total }: { label: string; totalLabel: string; total: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4">
      <h3 className="font-bold capitalize">{label}</h3>
      <p className="text-sm font-semibold text-slate-600">{totalLabel}: <span className="text-ink">{formatCurrency(total)}</span></p>
    </div>
  );
}

function filterIncome(item: Income, filter: string) {
  if (filter === "manuales") return item.source !== "airbnb";
  if (filter === "airbnb") return item.source === "airbnb";
  if (filter === "pending") return item.amount_status === "missing" || item.amount === null || item.amount === undefined;
  if (filter === "completed") return item.amount_status !== "missing" && item.amount !== null && item.amount !== undefined;
  return true;
}

function ReservationsPanel({
  property,
  reservations,
  stats,
  earningsImport,
  pendingSave,
  pendingSync,
  pendingIncome,
  pendingEarningsImport,
  pendingEarningsApply,
  onSaveIcal,
  onSync,
  onDisconnect,
  onImportEarnings,
  onApplyEarnings,
  onCreateIncome,
  onUpdateAmount,
  onUpdateGuestCount,
  onUpdateReservation
}: {
  property: Property;
  reservations: Reservation[];
  stats?: AirbnbStats;
  earningsImport: AirbnbEarningsImport | null;
  pendingSave: boolean;
  pendingSync: boolean;
  pendingIncome: boolean;
  pendingEarningsImport: boolean;
  pendingEarningsApply: boolean;
  onSaveIcal: (data: Record<string, unknown>) => void;
  onSync: () => void;
  onDisconnect: () => void;
  onImportEarnings: (file: File) => void;
  onApplyEarnings: (importId: string) => void;
  onCreateIncome: (reservationId: string, data: Record<string, unknown>) => void;
  onUpdateAmount: (reservationId: string, data: Record<string, unknown>) => void;
  onUpdateGuestCount: (reservationId: string, data: Record<string, unknown>) => void;
  onUpdateReservation: (reservationId: string, data: Record<string, unknown>) => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [filter, setFilter] = useState("upcoming");
  function submitIcal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSaveIcal({ airbnb_ical_url: String(form.get("airbnb_ical_url") ?? "") });
  }
  function submitEarningsCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("airbnb_csv") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (file) onImportEarnings(file);
  }
  const today = new Date();
  const filteredReservations = reservations.filter((reservation) => {
    const checkOut = new Date(reservation.check_out);
    const amountMissing = reservation.income_amount_status === "missing" || reservation.income_amount === null || reservation.income_amount === undefined;
    if (filter === "upcoming") return checkOut >= today;
    if (filter === "past") return checkOut < today;
    if (filter === "missing") return amountMissing;
    if (filter === "completed") return !amountMissing;
    return true;
  });
  return (
    <section className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Reservas</h3>
            <p className="text-sm text-slate-500">Fuente: Airbnb iCal</p>
            <p className="mt-2 text-sm text-slate-500">Airbnb iCal sincroniza fechas de reservas, pero el importe debe completarse manualmente.</p>
            <p className={`mt-3 inline-flex rounded-md px-3 py-1 text-sm font-semibold ${property.airbnb_ical_url ? "bg-emerald-50 text-meadow" : "bg-slate-100 text-slate-600"}`}>
              {property.airbnb_ical_url ? "URL iCal guardada" : "Airbnb no conectado"}
            </p>
            {property.airbnb_ical_url && <p className="mt-2 text-xs text-slate-500">{maskIcalUrl(property.airbnb_ical_url)}</p>}
            <p className="mt-2 text-xs text-slate-500">Ultima sincronizacion: {formatDate(property.airbnb_last_sync_at)}</p>
            <p className="mt-1 text-xs text-slate-500">Reservas importadas: {stats?.reservations_total ?? reservations.length}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!property.airbnb_ical_url || pendingSync} onClick={onSync} className="bg-meadow hover:bg-green-700">Sincronizar ahora</Button>
            {property.airbnb_ical_url && <Button disabled={pendingSync} onClick={onDisconnect} className="bg-white text-coral hover:bg-slate-50">Desconectar Airbnb iCal</Button>}
          </div>
        </div>
        <form onSubmit={submitIcal} className="mt-5 grid gap-3 lg:grid-cols-[1fr_160px]">
          <input name="airbnb_ical_url" defaultValue={property.airbnb_ical_url ?? ""} required placeholder="URL iCal de Airbnb" className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
          <Button disabled={pendingSave} className="bg-ink">Guardar URL</Button>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-bold">Importar ingresos reales de Airbnb</h3>
            <p className="mt-2 text-sm text-slate-500">iCal solo sincroniza fechas. Para completar importes reales, descarga un CSV desde el panel de ingresos de Airbnb y súbelo aquí.</p>
          </div>
          {earningsImport && (
            <span className="rounded-md bg-emerald-50 px-3 py-1 text-sm font-semibold text-meadow">
              {earningsImport.rows_applied} aplicadas de {earningsImport.rows_total}
            </span>
          )}
        </div>
        <form onSubmit={submitEarningsCsv} className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px]">
          <input name="airbnb_csv" type="file" accept=".csv,text/csv" required className="block h-10 rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-semibold" />
          <Button disabled={pendingEarningsImport} className="bg-ink">Subir CSV</Button>
        </form>
        {earningsImport && (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 p-3">
              <p className="text-sm text-slate-600">
                {earningsImport.filename ?? "CSV Airbnb"} · {earningsImport.rows_matched} coincidencias seguras · estado: {labelEarningsImportStatus(earningsImport.status)}
              </p>
              <Button disabled={pendingEarningsApply || earningsImport.rows_matched === 0} onClick={() => onApplyEarnings(earningsImport.id)} className="bg-meadow hover:bg-green-700">
                Aplicar coincidencias seguras
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Fechas</th>
                    <th className="p-3">Huésped</th>
                    <th className="p-3">Importe</th>
                    <th className="p-3">Coincidencia</th>
                    <th className="p-3">Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {earningsImport.rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="p-3">{formatDate(row.suggested_check_in)} - {formatDate(row.suggested_check_out)}</td>
                      <td className="p-3">{row.suggested_guest_name ?? "Sin huésped"}</td>
                      <td className="p-3 font-semibold">{formatCurrency(Number(row.suggested_amount ?? 0))}</td>
                      <td className="p-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${toneEarningsRow(row.match_status)}`}>
                          {labelEarningsRowStatus(row.match_status)} {row.match_confidence ? `· ${Number(row.match_confidence).toFixed(2)}` : ""}
                        </span>
                      </td>
                      <td className="p-3">{row.applied ? "Importe confirmado por CSV" : row.income_amount_status ? labelAmountStatus(row.income_amount_status) : "Pendiente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <section className="grid gap-3 md:grid-cols-6">
        <Metric title="Proximo check-in" value={formatDate(stats?.next_check_in)} icon={<CalendarClock className="h-5 w-5" />} />
        <Metric title="Proximo check-out" value={formatDate(stats?.next_check_out)} icon={<CalendarClock className="h-5 w-5" />} />
        <Metric title="Noches este mes" value={String(stats?.booked_nights_current_month ?? 0)} icon={<CalendarClock className="h-5 w-5" />} />
        <Metric title="Ocupacion 30 dias" value={`${stats?.occupancy_next_30_days ?? 0}%`} icon={<Wallet className="h-5 w-5" />} />
        <Metric title="Entradas del mes" value={String(countMonthCheckIns(reservations, monthCursor))} icon={<Receipt className="h-5 w-5" />} />
        <Metric title="Salidas del mes" value={String(countMonthCheckOuts(reservations, monthCursor))} icon={<Plus className="h-5 w-5" />} />
      </section>

      <ReservationCalendar reservations={reservations} month={monthCursor} onMonthChange={setMonthCursor} />

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {[
            ["upcoming", "Proximas"],
            ["past", "Pasadas"],
            ["all", "Todas"],
            ["missing", "Pendientes de importe"],
            ["completed", "Con importe"]
          ].map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value)} className={`rounded-md px-3 py-2 text-sm font-semibold ${filter === value ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3">
        {filteredReservations.map((reservation) => (
          <ReservationCard
            key={reservation.id}
            reservation={reservation}
            pending={pendingIncome}
            onCreateIncome={onCreateIncome}
            onUpdateAmount={onUpdateAmount}
            onUpdateGuestCount={onUpdateGuestCount}
            onUpdateReservation={onUpdateReservation}
          />
        ))}
        {filteredReservations.length === 0 && <Card className="p-5 text-sm text-slate-500">No hay reservas para este filtro.</Card>}
      </div>
    </section>
  );
}
function ReservationCard({
  reservation,
  pending,
  onCreateIncome,
  onUpdateAmount,
  onUpdateGuestCount,
  onUpdateReservation
}: {
  reservation: Reservation;
  pending: boolean;
  onCreateIncome: (reservationId: string, data: Record<string, unknown>) => void;
  onUpdateAmount: (reservationId: string, data: Record<string, unknown>) => void;
  onUpdateGuestCount: (reservationId: string, data: Record<string, unknown>) => void;
  onUpdateReservation: (reservationId: string, data: Record<string, unknown>) => void;
}) {
  const [amount, setAmount] = useState(reservation.income_amount?.toString() ?? "");
  const [guestCount, setGuestCount] = useState(reservation.guest_count?.toString() ?? "");
  const hasIncome = Boolean(reservation.income_id);
  const amountPending = !hasIncome || reservation.income_amount_status === "missing" || reservation.income_amount === null || reservation.income_amount === undefined;
  const reservationName = displayReservationName(reservation);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">{reservationName}</p>
          <p className="text-sm text-slate-500">Check-in: {formatDate(reservation.check_in)} · Check-out: {formatDate(reservation.check_out)} · {reservation.nights ?? "-"} noches</p>
          <p className="mt-1 text-sm text-slate-500">Huespedes: {reservation.guest_count ?? "Sin indicar"} · Estado: {labelReservationStatus(reservation.status)}</p>
          <p className="mt-1 text-sm text-slate-500">Ingreso: {hasIncome ? "Ingreso creado" : "sin crear"} · Importe: {amountPending ? "Pendiente de importe" : `${formatCurrency(reservation.income_amount)} · ${labelAmountStatus(reservation.income_amount_status)}`}</p>
          {reservation.income_data_origin === "airbnb_csv" && !amountPending && <p className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-meadow">Importe confirmado por CSV</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => onCreateIncome(reservation.id, {})} className="bg-ink">{hasIncome ? "Ingreso creado" : "Crear ingreso"}</Button>
          <Button disabled={pending} onClick={() => onUpdateReservation(reservation.id, { status: "cancelled" })} className="bg-white text-coral hover:bg-slate-50">Cancelar</Button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
        <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" step="0.01" placeholder="Importe manual" className="h-10 rounded-md border border-slate-300 px-3" />
        <Button disabled={pending || !amount} onClick={() => onUpdateAmount(reservation.id, { amount })} className="bg-meadow hover:bg-green-700">Completar importe</Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
        <input value={guestCount} onChange={(event) => setGuestCount(event.target.value)} type="number" min="1" step="1" placeholder="Numero de huespedes" className="h-10 rounded-md border border-slate-300 px-3" />
        <Button disabled={pending || !guestCount} onClick={() => onUpdateGuestCount(reservation.id, { guest_count: guestCount })} className="bg-white text-ink hover:bg-slate-50">Editar huespedes</Button>
      </div>
    </Card>
  );
}

function ReservationCalendar({ reservations, month, onMonthChange }: { reservations: Reservation[]; month: Date; onMonthChange: (date: Date) => void }) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, index) => index < startOffset ? null : new Date(month.getFullYear(), month.getMonth(), index - startOffset + 1));
  const todayKey = dateKey(new Date());
  const monthLabel = formatCalendarMonth(month);
  const selectedReservations = selectedDay ? reservations.filter((reservation) => reservationTouchesDate(reservation, selectedDay)) : [];
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold">{monthLabel}</h3>
        <div className="flex gap-2">
          <Button onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="bg-white text-ink hover:bg-slate-50">Anterior</Button>
          <Button onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="bg-white text-ink hover:bg-slate-50">Siguiente</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
        {["L", "M", "X", "J", "V", "S", "D"].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="aspect-square rounded-md bg-slate-50" />;
          const key = dateKey(day);
          const activeReservations = reservations.filter((reservation) => reservationOccupiesDate(reservation, day));
          const checkIns = reservations.filter((reservation) => dateKey(new Date(reservation.check_in)) === key);
          const checkOuts = reservations.filter((reservation) => dateKey(new Date(reservation.check_out)) === key);
          const isBooked = activeReservations.length > 0;
          const guestLabel = displayReservationName(checkIns[0] ?? checkOuts[0] ?? activeReservations[0]);
          return (
            <button type="button" key={key} onClick={() => setSelectedDay(day)} className={`min-h-24 rounded-md border p-2 text-left ${isBooked ? "border-meadow bg-emerald-50 text-ink" : "border-slate-200 bg-white"} ${key === todayKey ? "ring-2 ring-sun" : ""}`}>
              <p className="text-base font-bold">{day.getDate()}</p>
              {checkIns.length > 0 && <p className="mt-1 text-xs font-bold text-meadow">Entrada{checkIns.length > 1 ? ` (x${checkIns.length})` : ""}</p>}
              {checkOuts.length > 0 && <p className="text-xs font-bold text-coral">Salida{checkOuts.length > 1 ? ` (x${checkOuts.length})` : ""}</p>}
              {isBooked && checkIns.length === 0 && checkOuts.length === 0 && <p className="mt-1 text-xs font-semibold">Reservado</p>}
              {(checkIns.length > 0 || checkOuts.length > 0 || isBooked) && <p className="mt-1 truncate text-xs text-slate-600">{guestLabel}</p>}
            </button>
          );
        })}
      </div>
      {selectedDay && (
        <div className="mt-4 rounded-md border border-slate-200 p-3">
          <p className="font-semibold">{formatDate(selectedDay.toISOString())}</p>
          <div className="mt-2 grid gap-2">
            {selectedReservations.map((reservation) => (
              <p key={reservation.id} className="rounded-md bg-slate-100 p-2 text-sm">{displayReservationName(reservation)} · {formatDate(reservation.check_in)} - {formatDate(reservation.check_out)}</p>
            ))}
            {selectedReservations.length === 0 && <p className="text-sm text-slate-500">Sin reservas este dia.</p>}
          </div>
        </div>
      )}
    </Card>
  );
}

function DriveConnectForm({
  folders,
  googleConnected,
  pending,
  loadingFolders,
  folderError,
  onLoadFolders,
  onSubmit
}: {
  folders: AvailableDriveFolder[];
  googleConnected: boolean;
  pending: boolean;
  loadingFolders: boolean;
  folderError: unknown;
  onLoadFolders: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [folderSearch, setFolderSearch] = useState("");
  const visibleFolders = folders.filter((folder) => folder.name.toLowerCase().includes(folderSearch.toLowerCase().trim()));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedFolderId = String(form.get("drive_folder_id") ?? "");
    const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);
    const manualFolder = String(form.get("folder_url") ?? "");
    onSubmit({
      folder_title: String(form.get("folder_title") ?? ""),
      folder_id: mode === "select" ? selectedFolderId : manualFolder,
      folder_url: mode === "select" ? selectedFolder?.webViewLink ?? "" : manualFolder,
      folder_type: String(form.get("folder_type") ?? "otros"),
      provider_hint: ""
    });
    event.currentTarget.reset();
    setFolderSearch("");
  }
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Titulo de la carpeta en Hogarflow</span>
          <input name="folder_title" required placeholder="Facturas" className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Tipo de carpeta</span>
          <select name="folder_type" className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow">
            {["facturas", "documentos", "seguros", "contratos", "ibi", "comunidad", "mantenimiento", "reservas", "otros"].map((item) => <option key={item} value={item}>{labelFolderType(item)}</option>)}
          </select>
        </label>
      </div>

      <div className="rounded-md border border-slate-200 p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("select")} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "select" ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>Buscar carpeta en Drive</button>
          <button type="button" onClick={() => setMode("manual")} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "manual" ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>Pegar URL o ID de carpeta</button>
        </div>
        {mode === "select" && (
          <div className="grid gap-3">
            {googleConnected && folders.length === 0 && (
              <Button type="button" disabled={loadingFolders} onClick={onLoadFolders} className="bg-white text-ink hover:bg-slate-50">
                {loadingFolders ? "Cargando carpetas..." : "Cargar carpetas de Drive"}
              </Button>
            )}
            {Boolean(folderError) && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">No se pudieron cargar carpetas de Drive. Revisa la autorizacion de Google y vuelve a intentarlo.</p>}
            {folders.length > 0 && (
              <>
                <input value={folderSearch} onChange={(event) => setFolderSearch(event.target.value)} placeholder="Buscar por nombre: Pastores, Facturas, Documentos..." className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
                <select name="drive_folder_id" required disabled={!googleConnected || visibleFolders.length === 0} className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow">
                  <option value="">{visibleFolders.length > 0 ? "Selecciona una carpeta de Drive" : "No hay carpetas con ese nombre"}</option>
                  {visibleFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </>
            )}
            {!googleConnected && <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">Autoriza Google Drive para buscar carpetas disponibles.</p>}
          </div>
        )}
        {mode === "manual" && (
          <input name="folder_url" required placeholder="URL o ID de carpeta Drive" className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
        )}
      </div>

      <Button disabled={pending || (mode === "select" && (!googleConnected || folders.length === 0))} className="bg-ink">Conectar carpeta</Button>
    </form>
  );
}

function DriveFolderCard({ folder, pending, onSync, onUpdate, onDelete }: { folder: DriveFolderMapping; pending: boolean; onSync: (folderId: string) => void; onUpdate: (folderId: string, data: Record<string, unknown>) => void; onDelete: (folderId: string) => void }) {
  const [folderType, setFolderType] = useState(folder.folder_type);
  const [syncEnabled, setSyncEnabled] = useState(folder.sync_enabled);
  const [editing, setEditing] = useState(false);
  const realFolderName = folder.metadata?.drive_folder_name ?? folder.drive_folder_name;
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">{folder.drive_folder_name}</p>
          <p className="text-sm text-slate-500">Carpeta Drive: {realFolderName}</p>
          <p className="text-sm text-slate-500">Tipo: {labelFolderType(folder.folder_type)} · Archivos: {folder.file_count ?? 0}</p>
          <p className="text-xs text-slate-500">Ultima sincronizacion: {formatDate(folder.last_sync_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || !folder.sync_enabled} onClick={() => onSync(folder.id)} className="bg-meadow hover:bg-green-700">Sincronizar</Button>
          <Button onClick={() => setEditing(!editing)} className="bg-ink">Editar</Button>
          <button onClick={() => onDelete(folder.id)} className="h-10 rounded-md border border-coral px-3 text-sm font-semibold text-coral">Desconectar</button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_140px_120px]">
          <select value={folderType} onChange={(event) => setFolderType(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            {["facturas", "documentos", "seguros", "contratos", "ibi", "comunidad", "mantenimiento", "reservas", "otros"].map((item) => <option key={item} value={item}>{labelFolderType(item)}</option>)}
          </select>
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm">
            <input type="checkbox" checked={syncEnabled} onChange={(event) => setSyncEnabled(event.target.checked)} />
            Activa
          </label>
          <Button onClick={() => onUpdate(folder.id, { folder_type: folderType, sync_enabled: syncEnabled })} className="bg-ink">Guardar</Button>
        </div>
      )}
    </div>
  );
}

function DriveFileCard({
  file,
  expenses,
  documents,
  pending,
  onUpdate,
  onLinkExpense,
  onLinkDocument,
  onRegisterExpense,
  onSaveDocument,
  onRegisterIncome
}: {
  file: DriveFile;
  expenses: Expense[];
  documents: DocumentItem[];
  pending: boolean;
  onUpdate: (fileId: string, data: Record<string, unknown>) => void;
  onLinkExpense: (fileId: string, expenseId: string) => void;
  onLinkDocument: (fileId: string, documentId: string) => void;
  onRegisterExpense: (fileId: string, data: Record<string, unknown>) => void;
  onSaveDocument: (fileId: string, data: Record<string, unknown>) => void;
  onRegisterIncome: (fileId: string, data: Record<string, unknown>) => void;
}) {
  const [expenseId, setExpenseId] = useState(file.linked_expense_id ?? "");
  const [documentId, setDocumentId] = useState(file.linked_document_id ?? "");
  const [mode, setMode] = useState<"none" | "expense" | "income" | "linkExpense" | "document" | "linkDocument">("none");
  const defaultDate = (file.modified_time ?? file.created_time ?? new Date().toISOString()).slice(0, 10);
  function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onRegisterExpense(file.id, {
      description: String(form.get("description") ?? file.name),
      expense_date: String(form.get("expense_date") ?? defaultDate),
      amount: String(form.get("amount") ?? ""),
      category: String(form.get("category") ?? "other"),
      provider: String(form.get("provider") ?? ""),
      notes: String(form.get("notes") ?? "")
    });
  }
  function submitIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onRegisterIncome(file.id, {
      description: String(form.get("description") ?? file.name),
      income_date: String(form.get("income_date") ?? defaultDate),
      amount: String(form.get("amount") ?? ""),
      source: String(form.get("source") ?? "google_drive"),
      notes: String(form.get("notes") ?? "")
    });
  }
  function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSaveDocument(file.id, {
      title: String(form.get("title") ?? file.name),
      type: String(form.get("document_type") ?? "other_essential"),
      document_type: String(form.get("document_type") ?? "other_essential"),
      document_category: "essential",
      valid_until: String(form.get("valid_until") ?? ""),
      expiration_date: String(form.get("valid_until") ?? ""),
      notes: String(form.get("notes") ?? "")
    });
  }
  return (
    <Card className={`border p-4 ${reviewStatusClasses(file.review_status)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{file.name}</p>
          <p className="text-sm text-slate-500">Tipo: {labelMimeType(file.mime_type)} · Carpeta: {file.source_folder_name ?? labelFolderType(file.folder_type)} · Modificado: {formatDate(file.modified_time)}</p>
          <p className="mt-2 inline-flex rounded-md bg-white px-3 py-1 text-sm font-semibold">Estado: {labelReviewStatus(file.review_status)}</p>
          {(file.linked_expense_description || file.linked_document_title) && (
            <p className="mt-2 text-sm text-slate-600">Asociado a: {file.linked_expense_description ?? file.linked_document_title}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {file.web_view_link && (
            <a href={file.web_view_link} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white">
              <ExternalLink className="h-4 w-4" />
              Abrir en Drive
            </a>
          )}
          <Button disabled={pending} onClick={() => setMode(mode === "expense" ? "none" : "expense")} className="bg-meadow hover:bg-green-700">Registrar como gasto</Button>
          <Button disabled={pending} onClick={() => setMode(mode === "income" ? "none" : "income")} className="bg-white text-meadow hover:bg-slate-50">Registrar como ingreso</Button>
          <Button disabled={pending} onClick={() => setMode(mode === "document" ? "none" : "document")} className="bg-white text-ink hover:bg-slate-50">Registrar como documento esencial</Button>
          <Button disabled={pending} onClick={() => onUpdate(file.id, { review_status: "ignored" })} className="bg-white text-slate-600 hover:bg-slate-50">Ignorar</Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setMode(mode === "linkExpense" ? "none" : "linkExpense")} className="text-sm font-semibold text-meadow">Asociar a gasto existente</button>
        <button onClick={() => setMode(mode === "linkDocument" ? "none" : "linkDocument")} className="text-sm font-semibold text-meadow">Asociar a documento existente</button>
      </div>

      {mode === "expense" && (
        <form onSubmit={submitExpense} className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Concepto</span>
            <input name="description" defaultValue={file.name} required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Fecha</span>
            <input name="expense_date" type="date" defaultValue={defaultDate} required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Importe</span>
            <input name="amount" type="number" step="0.01" required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Proveedor</span>
            <input name="provider" className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Categoria general</span>
            <select name="category" defaultValue="other" className="h-10 w-full rounded-md border border-slate-300 px-3">
              {expenseInboxCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Notas</span>
            <input name="notes" className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <Button disabled={pending} className="bg-meadow hover:bg-green-700 md:col-span-2">Guardar gasto</Button>
        </form>
      )}

      {mode === "income" && (
        <form onSubmit={submitIncome} className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Concepto</span>
            <input name="description" defaultValue={file.name} required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Fecha ingreso</span>
            <input name="income_date" type="date" defaultValue={defaultDate} required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Importe</span>
            <input name="amount" type="number" step="0.01" required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Origen</span>
            <input name="source" defaultValue="google_drive" className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium">Notas</span>
            <input name="notes" className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <Button disabled={pending} className="bg-meadow hover:bg-green-700 md:col-span-2">Guardar ingreso</Button>
        </form>
      )}

      {mode === "document" && (
        <form onSubmit={submitDocument} className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Titulo</span>
            <input name="title" defaultValue={file.name} required className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tipo de documento</span>
            <select name="document_type" defaultValue="other_essential" className="h-10 w-full rounded-md border border-slate-300 px-3">
              {essentialDocumentTypes().map((item) => <option key={item} value={item}>{labelDocumentType(item)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Vencimiento opcional</span>
            <input name="valid_until" type="date" className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Notas</span>
            <input name="notes" className="h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <Button disabled={pending} className="bg-meadow hover:bg-green-700 md:col-span-2">Guardar documento</Button>
        </form>
      )}

      {mode === "linkExpense" && (
        <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px]">
          <select value={expenseId} onChange={(event) => setExpenseId(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            <option value="">Selecciona gasto de esta vivienda</option>
            {expenses.map((expense) => <option key={expense.id} value={expense.id}>{formatDate(expense.expense_date)} · {expense.description ?? expense.category} · {formatCurrency(expense.amount)}</option>)}
          </select>
          <Button disabled={!expenseId || pending} onClick={() => onLinkExpense(file.id, expenseId)} className="bg-ink">Asociar gasto</Button>
        </div>
      )}

      {mode === "linkDocument" && (
        <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px]">
          <select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
            <option value="">Selecciona documento de esta vivienda</option>
            {documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
          </select>
          <Button disabled={!documentId || pending} onClick={() => onLinkDocument(file.id, documentId)} className="bg-ink">Asociar documento</Button>
        </div>
      )}
    </Card>
  );
}

const expenseInboxCategories = [
  { value: "electricity", label: "Luz" },
  { value: "water", label: "Agua" },
  { value: "gas", label: "Gas" },
  { value: "internet", label: "Internet" },
  { value: "cleaning", label: "Limpieza" },
  { value: "supplies", label: "Utiles" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "repairs", label: "Reparaciones" },
  { value: "renovation", label: "Reforma" },
  { value: "furniture", label: "Mobiliario" },
  { value: "other", label: "Otros" }
];

function reviewStatusClasses(value?: string | null) {
  const classes: Record<string, string> = {
    pending_review: "border-amber-200 bg-amber-50",
    registered: "border-emerald-200 bg-emerald-50",
    registered_document: "border-emerald-200 bg-emerald-50",
    registered_expense: "border-emerald-200 bg-emerald-50",
    registered_income: "border-emerald-200 bg-emerald-50",
    linked: "border-emerald-200 bg-emerald-50",
    reviewed: "border-sky-200 bg-sky-50",
    ignored: "border-slate-200 bg-slate-50"
  };
  return classes[String(value ?? "pending_review")] ?? classes.pending_review;
}

function labelFolderType(value?: string | null) {
  const labels: Record<string, string> = {
    facturas: "Facturas",
    documentos: "Documentos",
    seguros: "Seguros",
    contratos: "Contratos",
    ibi: "IBI",
    comunidad: "Comunidad",
    mantenimiento: "Mantenimiento",
    reservas: "Reservas",
    otros: "Otros"
  };
  return labels[String(value ?? "otros")] ?? "Otros";
}

function labelReviewStatus(value?: string | null) {
  const labels: Record<string, string> = {
    pending_review: "Pendiente",
    registered: "Registrado",
    registered_document: "Documento esencial",
    registered_expense: "Gasto registrado",
    registered_income: "Ingreso registrado",
    reviewed: "Revisado",
    linked: "Asociado",
    ignored: "Ignorado"
  };
  return labels[String(value ?? "pending_review")] ?? "Pendiente";
}

function labelDocumentType(value?: string | null) {
  const labels: Record<string, string> = {
    home_insurance: "Seguro hogar",
    garbage_tax: "Basuras",
    energy_certificate: "Certificado energetico",
    occupancy_certificate: "Cedula de habitabilidad",
    tourist_license: "Licencia turistica",
    other_essential: "Otro documento esencial",
    factura: "Factura",
    contrato: "Contrato",
    seguro: "Seguro",
    ibi: "IBI",
    comunidad: "Comunidad",
    certificado: "Certificado",
    garantia: "Garantia",
    manual: "Manual",
    mantenimiento: "Mantenimiento",
    reserva: "Reserva",
    otro: "Otro",
    insurance: "Seguro",
    contract: "Contrato",
    certificate: "Certificado",
    warranty: "Garantia",
    other: "Otro"
  };
  return labels[String(value ?? "")] ?? "Sin clasificar";
}

function essentialDocumentTypes() {
  return ["other_essential", "other"];
}

function labelDocumentStatus(value?: string | null) {
  const labels: Record<string, string> = {
    pending_review: "Pendiente",
    registered: "Registrado",
    reviewed: "Revisado",
    linked: "Asociado",
    ignored: "Ignorado"
  };
  return labels[String(value ?? "pending_review")] ?? "Pendiente";
}

function labelMimeType(value?: string | null) {
  const mime = String(value ?? "").toLowerCase();
  if (mime.includes("pdf")) return "PDF";
  if (mime.startsWith("image/")) return "Imagen";
  if (mime.includes("document") || mime.includes("word") || mime.includes("text")) return "Documento";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "Hoja de calculo";
  return "Archivo";
}

function labelDriveFilter(value: string) {
  const labels: Record<string, string> = {
    todos: "Todos",
    pending_review: "Pendientes",
    registered: "Registrados",
    registered_document: "Documentos",
    registered_expense: "Gastos",
    registered_income: "Ingresos",
    reviewed: "Revisados",
    linked: "Asociados",
    ignored: "Ignorados"
  };
  return labels[value] ?? value;
}

function labelOperationType(value?: string | null) {
  const labels: Record<string, string> = {
    tourist: "Turistica",
    long_term: "Larga estancia",
    own_use: "Uso propio",
    mixed: "Mixta",
    inactive: "Inactiva",
    airbnb: "Turistica"
  };
  return labels[String(value ?? "mixed")] ?? "Mixta";
}

function labelReservationStatus(value?: string | null) {
  const labels: Record<string, string> = {
    confirmed: "Confirmada",
    cancelled: "Cancelada",
    blocked: "Bloqueada",
    removed_from_calendar: "Ya no aparece en iCal"
  };
  return labels[String(value ?? "confirmed")] ?? "Confirmada";
}

function labelAmountStatus(value?: string | null) {
  const labels: Record<string, string> = {
    missing: "Pendiente importe",
    manual: "Manual",
    estimated: "Estimado",
    confirmed: "Confirmado"
  };
  return labels[String(value ?? "missing")] ?? "Pendiente importe";
}

function labelExpenseCategory(value?: string | null) {
  const labels: Record<string, string> = {
    electricity: "Luz",
    water: "Agua",
    gas: "Gas",
    internet: "Internet",
    community: "Comunidad",
    cleaning: "Limpieza",
    supplies: "Utiles",
    supermarket: "Supermercado",
    ibi: "IBI",
    garbage: "Basuras",
    home_insurance: "Seguro hogar",
    liability_insurance: "Seguro responsabilidad",
    rental_insurance: "Seguro alquiler",
    maintenance: "Mantenimiento",
    repairs: "Reparaciones",
    furniture: "Mobiliario",
    mortgage: "Hipoteca",
    financing: "Financiacion",
    loan_interest: "Intereses",
    other: "Otros"
  };
  return labels[String(value ?? "other")] ?? String(value ?? "Otros");
}

function labelEarningsImportStatus(value?: string | null) {
  const labels: Record<string, string> = {
    pending_review: "Pendiente de revisión",
    ready_to_apply: "Lista para aplicar",
    needs_review: "Necesita revisión",
    partially_applied: "Parcialmente aplicada",
    applied: "Aplicada"
  };
  return labels[String(value ?? "pending_review")] ?? "Pendiente de revisión";
}

function labelEarningsRowStatus(value?: string | null) {
  const labels: Record<string, string> = {
    matched: "Coincidencia segura",
    possible_match: "Posible coincidencia",
    unmatched: "Sin coincidencia",
    applied: "Aplicada"
  };
  return labels[String(value ?? "unmatched")] ?? "Sin coincidencia";
}

function toneEarningsRow(value?: string | null) {
  if (value === "applied") return "bg-emerald-50 text-meadow";
  if (value === "matched") return "bg-blue-50 text-blue-700";
  if (value === "possible_match") return "bg-yellow-50 text-yellow-700";
  return "bg-slate-100 text-slate-600";
}

function maskIcalUrl(value?: string | null) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const token = url.searchParams.get("t");
    if (token) url.searchParams.set("t", "****");
    const path = url.pathname.replace(/\/ical\/[^/]+\.ics/i, "/ical/xxxxx.ics");
    return `${url.origin}${path}${url.search}`;
  } catch {
    return "URL iCal guardada";
  }
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function reservationOccupiesDate(reservation: Reservation, day: Date) {
  if (reservation.status === "cancelled" || reservation.status === "removed_from_calendar") return false;
  const start = new Date(reservation.check_in);
  const end = new Date(reservation.check_out);
  const current = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return current >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) && current < new Date(end.getFullYear(), end.getMonth(), end.getDate());
}

function reservationTouchesDate(reservation: Reservation, day: Date) {
  if (reservation.status === "cancelled" || reservation.status === "removed_from_calendar") return false;
  const key = dateKey(day);
  return reservationOccupiesDate(reservation, day) || dateKey(new Date(reservation.check_in)) === key || dateKey(new Date(reservation.check_out)) === key;
}

function countMonthCheckIns(reservations: Reservation[], month: Date) {
  return reservations.filter((reservation) => reservation.status !== "cancelled" && reservation.status !== "removed_from_calendar" && sameMonth(new Date(reservation.check_in), month)).length;
}

function countMonthCheckOuts(reservations: Reservation[], month: Date) {
  return reservations.filter((reservation) => reservation.status !== "cancelled" && reservation.status !== "removed_from_calendar" && sameMonth(new Date(reservation.check_out), month)).length;
}

function sameMonth(date: Date, month: Date) {
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

function formatCalendarMonth(value: Date) {
  const month = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(value);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} de ${value.getFullYear()}`;
}

function displayReservationName(reservation?: Reservation | null) {
  if (!reservation) return "Reserva Airbnb";
  const candidates = [reservation.guest_name, reservation.income_guest_name, reservation.title, reservation.income_description];
  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text && !isGenericReservationName(text)) return text.replace(/^Airbnb\s*-\s*/i, "");
  }
  return "Reserva Airbnb";
}

function isGenericReservationName(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["reserva", "reserved", "airbnb (not available)", "not available", "airbnb", "reserva airbnb"].includes(normalized);
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-md bg-emerald-50 text-meadow">{icon}</div>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </Card>
  );
}

function ExpenseStat({ title, subtitle, amount, plain }: { title: string; subtitle: string; amount: number; plain?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{subtitle}</p>
      <p className="mt-1 font-bold">{title}</p>
      <p className="mt-3 text-2xl font-bold">{plain ? String(amount) : formatCurrency(amount)}</p>
    </Card>
  );
}

function MonthlyProfitPanel({ stats }: { stats?: MonthlyProfitStats }) {
  const months = stats?.months ?? [];
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="font-bold">Rentabilidad por mes</h3>
        <p className="text-sm text-slate-500">Ingresos, gastos operativos, costes ordinarios y financiacion separados por mes.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {months.map((item) => (
          <div key={item.month} className={`rounded-md border p-3 ${monthlyProfitTone(item.net_profit)}`}>
            <p className="text-xs font-semibold uppercase">{shortMonthLabel(item.month)}</p>
            <p className="mt-2 text-lg font-bold">{formatCurrency(item.operating_profit ?? item.net_profit)}</p>
            <p className="mt-1 text-xs">Ing. {formatCurrency(item.income_total)}</p>
            <p className="text-xs">G. op. {formatCurrency(item.operating_expense_total ?? item.expense_total)}</p>
            <p className="text-xs">Ord. {formatCurrency(item.ordinary_cost_total ?? 0)}</p>
            <p className="text-xs">Intereses {formatCurrency(item.financing_interest_total ?? 0)}</p>
            <p className="text-xs">Amort. {formatCurrency(item.financing_principal_total ?? 0)}</p>
            <p className="text-xs font-semibold">Cashflow {formatCurrency(item.cashflow_after_financing ?? item.net_profit)}</p>
            <p className="text-xs">Ratio {item.expense_ratio === null || item.expense_ratio === undefined ? "-" : `${item.expense_ratio}%`}</p>
            <p className="text-xs">Pend. {item.pending_income_count ?? 0}</p>
          </div>
        ))}
        {months.length === 0 && <p className="text-sm text-slate-500">Todavia no hay datos mensuales.</p>}
      </div>
    </Card>
  );
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${value.toFixed(2)}%`;
}

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function parseMoneyInput(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "0").trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function parseNullableMoneyInput(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function formatMonthLabel(month: string) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
}

function shortMonthLabel(month: string) {
  return new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(`${month}-01T12:00:00`));
}

function monthlyProfitTone(value: number) {
  if (value < 0) return "border-red-200 bg-red-50 text-red-700";
  if (value < 500) return "border-yellow-200 bg-yellow-50 text-yellow-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function monthlyExpenseDefaults(): MonthlyExpenseState["items"] {
  return [
    { category: "electricity", label: "Luz", amount: 0 },
    { category: "water", label: "Agua", amount: 0 },
    { category: "gas", label: "Gas", amount: 0 },
    { category: "internet", label: "Internet", amount: 0 },
    { category: "cleaning", label: "Limpieza", amount: 0 },
    { category: "supplies", label: "Utiles", amount: 0 },
    { category: "maintenance", label: "Mantenimiento", amount: 0 },
    { category: "repairs", label: "Reparaciones", amount: 0 },
    { category: "renovation", label: "Reforma", amount: 0 },
    { category: "furniture", label: "Mobiliario", amount: 0 },
    { category: "other", label: "Otros", amount: 0 }
  ];
}

function Row({ title, subtitle, amount }: { title: string; subtitle: string; amount: number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="truncate text-sm text-slate-500">{subtitle}</p>
      </div>
      <p className="font-bold">{formatCurrency(amount)}</p>
    </div>
  );
}

function IncomeRow({
  item,
  editing,
  pending: saving,
  onEdit,
  onCancel,
  onUpdate
}: {
  item: Income;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onUpdate: (data: Record<string, unknown>) => void;
}) {
  const pending = item.amount_status === "missing" || item.amount === null || item.amount === undefined;
  return (
    <div className="border-b border-slate-200 p-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold">{item.source === "airbnb" ? item.description ?? (item.guest_name ? `Airbnb - ${item.guest_name}` : "Airbnb") : item.guest_name ?? item.description ?? "Ingreso"}</p>
          <p className="truncate text-sm text-slate-500">
            {item.guest_name ?? "Huesped sin indicar"} · {formatDate(item.check_in)} - {formatDate(item.check_out)} · {item.nights ?? "-"} noches
          </p>
          {item.is_demo && <p className="mt-1 text-xs font-semibold text-slate-500">Dato demo</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className={`font-bold ${pending ? "text-sun" : ""}`}>{pending ? "Pendiente de importe" : formatCurrency(item.amount)}</p>
          <Button disabled={saving} onClick={onEdit} className="bg-white text-ink hover:bg-slate-50">{editing ? "Cancelar" : "Editar"}</Button>
        </div>
      </div>
      {editing && <IncomeEditForm item={item} pending={saving} onCancel={onCancel} onSubmit={onUpdate} />}
    </div>
  );
}

function IncomeEditForm({
  item,
  pending,
  onSubmit,
  onCancel
}: {
  item: Income;
  pending: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = parseNullableMoneyInput(form.get("amount"));
    const amountStatus = String(form.get("amount_status") ?? (amount === null ? "missing" : "manual"));
    onSubmit({
      amount,
      amount_status: amount === null ? "missing" : amountStatus,
      income_date: String(form.get("income_date") ?? "") || item.income_date,
      description: String(form.get("description") ?? ""),
      guest_name: String(form.get("guest_name") ?? ""),
      check_in: String(form.get("check_in") ?? "") || null,
      check_out: String(form.get("check_out") ?? "") || null,
      nights: Number(form.get("nights") ?? item.nights ?? 0),
      currency: "EUR",
      is_demo: false
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Importe</span>
        <input name="amount" inputMode="decimal" defaultValue={item.amount === null || item.amount === undefined ? "" : String(item.amount).replace(".", ",")} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Estado importe</span>
        <select name="amount_status" defaultValue={item.amount_status ?? "missing"} className="h-10 w-full rounded-md border border-slate-300 px-3">
          {["missing","manual","estimated","confirmed"].map((option) => <option key={option} value={option}>{labelAmountStatus(option)}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Fecha ingreso</span>
        <input name="income_date" type="date" defaultValue={dateInputValue(item.income_date)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Huesped</span>
        <input name="guest_name" defaultValue={item.guest_name ?? ""} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Check-in</span>
        <input name="check_in" type="date" defaultValue={dateInputValue(item.check_in)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Check-out</span>
        <input name="check_out" type="date" defaultValue={dateInputValue(item.check_out)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Noches</span>
        <input name="nights" type="number" min="0" defaultValue={item.nights ?? 0} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block md:col-span-2">
        <span className="mb-1 block text-sm font-medium">Descripcion</span>
        <input name="description" defaultValue={item.description ?? ""} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button disabled={pending} className="bg-ink">Guardar ingreso</Button>
        <Button type="button" disabled={pending} onClick={onCancel} className="bg-white text-ink hover:bg-slate-50">Cancelar</Button>
      </div>
    </form>
  );
}

function ExpenseForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  return <SimpleForm title="Nuevo gasto" pending={pending} fields={["provider", "amount", "expense_date", "description"]} labels={["Proveedor", "Importe", "Fecha", "Descripcion"]} defaults={{ category: "other" }} onSubmit={onSubmit} />;
}

function IncomeForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  return <SimpleForm title="Nuevo ingreso" pending={pending} fields={["guest_name", "amount", "income_date", "check_in", "check_out", "nights"]} labels={["Huesped", "Importe", "Fecha ingreso", "Entrada", "Salida", "Noches"]} defaults={{ source: "airbnb" }} onSubmit={onSubmit} />;
}

function FinancingForm({ pending, documents, onSubmit }: { pending: boolean; documents: DocumentItem[]; onSubmit: (data: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(readFinancingForm(form));
    event.currentTarget.reset();
  }
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold">Nuevo recibo de hipoteca</h3>
      <form onSubmit={submit} className="grid gap-3">
        <FinancingFields documents={documents} />
        <Button disabled={pending} className="bg-ink">Guardar financiacion</Button>
      </form>
    </Card>
  );
}

function GroupedFinancingView({
  data,
  pending,
  documents,
  onUpdate,
  onDelete
}: {
  data?: GroupedFinancing;
  pending: boolean;
  documents: DocumentItem[];
  onUpdate: (paymentId: string, data: Record<string, unknown>) => void;
  onDelete: (paymentId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const months = (data?.months ?? []).filter((month) => month.items.length > 0);
  return (
    <section className="space-y-3">
      <Card className="grid gap-3 p-4 md:grid-cols-4">
        <StatLine label="Cuotas año" value={formatCurrency(data?.year_total_payment ?? 0)} />
        <StatLine label="Intereses año" value={formatCurrency(data?.year_interest_total ?? 0)} />
        <StatLine label="Amortizacion año" value={formatCurrency(data?.year_principal_total ?? 0)} />
        <StatLine label="Capital pendiente" value={data?.latest_outstanding_principal === null || data?.latest_outstanding_principal === undefined ? "-" : formatCurrency(data.latest_outstanding_principal)} />
      </Card>
      {months.map((month) => (
        <Card key={month.month} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4">
            <h3 className="font-bold capitalize">{month.label}</h3>
            <p className="text-sm font-semibold text-slate-600">Cuota total: <span className="text-ink">{formatCurrency(month.total_payment ?? 0)}</span></p>
          </div>
          {month.items.map((item) => (
            <div key={item.id} className="border-b border-slate-200 p-4 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.lender ?? "Hipoteca"}</p>
                  <p className="text-sm text-slate-500">
                    Fecha recibo: {formatDate(item.payment_date)} · Intereses: {formatCurrency(item.interest_amount)} · Amortizacion: {formatCurrency(item.principal_amount)} · Capital pendiente: {item.outstanding_principal === null || item.outstanding_principal === undefined ? "-" : formatCurrency(item.outstanding_principal)}
                  </p>
                  {item.notes && <p className="mt-1 text-sm text-slate-500">{item.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-bold">{formatCurrency(item.total_payment)}</p>
                  <Button disabled={pending} onClick={() => setEditingId(editingId === item.id ? null : item.id)} className="bg-white text-ink hover:bg-slate-50">{editingId === item.id ? "Cancelar" : "Editar"}</Button>
                  <Button disabled={pending} onClick={() => onDelete(item.id)} className="bg-white text-red-700 hover:bg-red-50">Eliminar</Button>
                </div>
              </div>
              {editingId === item.id && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    onUpdate(item.id, readFinancingForm(new FormData(event.currentTarget)));
                    setEditingId(null);
                  }}
                  className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4"
                >
                  <FinancingFields item={item} documents={documents} />
                  <div className="flex gap-2">
                    <Button disabled={pending} className="bg-ink">Guardar cambios</Button>
                    <Button type="button" disabled={pending} onClick={() => setEditingId(null)} className="bg-white text-ink hover:bg-slate-50">Cancelar</Button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </Card>
      ))}
      {months.length === 0 && <Card className="p-5 text-sm text-slate-500">No hay recibos de financiacion para este año.</Card>}
    </section>
  );
}

function FinancingFields({ item, documents }: { item?: FinancingPayment; documents: DocumentItem[] }) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Mes</span>
        <input name="payment_month" type="month" required defaultValue={item?.payment_month ? dateInputValue(item.payment_month).slice(0, 7) : currentMonthKey()} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Fecha recibo</span>
        <input name="payment_date" type="date" required defaultValue={dateInputValue(item?.payment_date)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Banco / entidad</span>
        <input name="lender" defaultValue={item?.lender ?? ""} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Cuota total</span>
        <input name="total_payment" inputMode="decimal" required defaultValue={moneyInputValue(item?.total_payment)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Intereses / coste financiero</span>
        <input name="interest_amount" inputMode="decimal" required defaultValue={moneyInputValue(item?.interest_amount)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Amortizacion de capital</span>
        <input name="principal_amount" inputMode="decimal" required defaultValue={moneyInputValue(item?.principal_amount)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Capital pendiente</span>
        <input name="outstanding_principal" inputMode="decimal" defaultValue={moneyInputValue(item?.outstanding_principal)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Documento asociado</span>
        <select name="linked_document_id" defaultValue={item?.linked_document_id ?? ""} className="h-10 w-full rounded-md border border-slate-300 px-3">
          <option value="">Sin documento</option>
          {documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Notas</span>
        <textarea name="notes" rows={3} defaultValue={item?.notes ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
    </>
  );
}

function readFinancingForm(form: FormData) {
  return {
    payment_month: String(form.get("payment_month") ?? ""),
    payment_date: String(form.get("payment_date") ?? ""),
    lender: String(form.get("lender") ?? ""),
    total_payment: parseMoneyInput(form.get("total_payment")),
    interest_amount: parseMoneyInput(form.get("interest_amount")),
    principal_amount: parseMoneyInput(form.get("principal_amount")),
    outstanding_principal: parseNullableMoneyInput(form.get("outstanding_principal")),
    linked_document_id: String(form.get("linked_document_id") ?? "") || null,
    notes: String(form.get("notes") ?? "")
  };
}

function moneyInputValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return String(value).replace(".", ",");
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function DocumentForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      title: String(form.get("title") ?? ""),
      type: String(form.get("document_type") ?? "other_essential"),
      document_type: String(form.get("document_type") ?? "other_essential"),
      document_category: "essential",
      document_date: String(form.get("document_date") ?? ""),
      amount: parseNullableMoneyInput(form.get("amount")),
      currency: "EUR",
      valid_until: String(form.get("valid_until") ?? "") || null,
      expiration_date: String(form.get("valid_until") ?? "") || null,
      provider: String(form.get("provider") ?? ""),
      notes: String(form.get("notes") ?? ""),
      status: String(form.get("status") ?? "pending_review"),
      source: "manual",
      data_origin: "manual",
      is_demo: false
    });
    event.currentTarget.reset();
  }
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold">Nuevo documento esencial</h3>
      <form onSubmit={submit} className="grid gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Titulo</span>
          <input name="title" required className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Tipo</span>
          <select name="document_type" className="h-10 w-full rounded-md border border-slate-300 px-3">
            {essentialDocumentTypes().map((item) => <option key={item} value={item}>{labelDocumentType(item)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Fecha documento</span>
          <input name="document_date" type="date" required className="h-10 w-full rounded-md border border-slate-300 px-3" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Importe documental</span>
          <input name="amount" type="number" min="0" step="0.01" className="h-10 w-full rounded-md border border-slate-300 px-3" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Fecha vigencia / vencimiento</span>
          <input name="valid_until" type="date" className="h-10 w-full rounded-md border border-slate-300 px-3" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Organismo / proveedor</span>
          <input name="provider" className="h-10 w-full rounded-md border border-slate-300 px-3" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Estado</span>
          <select name="status" className="h-10 w-full rounded-md border border-slate-300 px-3">
            {["pending_review","registered","reviewed","linked","ignored"].map((item) => <option key={item} value={item}>{labelDocumentStatus(item)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Notas</span>
          <textarea name="notes" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <Button disabled={pending} className="bg-ink">Guardar documento</Button>
      </form>
    </Card>
  );
}

function DocumentEditForm({
  item,
  pending,
  onSubmit,
  onCancel
}: {
  item: DocumentItem;
  pending: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get("document_type") ?? "other_essential");
    onSubmit({
      title: String(form.get("title") ?? ""),
      type,
      document_type: type,
      document_category: "essential",
      document_date: String(form.get("document_date") ?? "") || null,
      amount: parseNullableMoneyInput(form.get("amount")),
      currency: "EUR",
      valid_until: String(form.get("valid_until") ?? "") || null,
      expiration_date: String(form.get("valid_until") ?? "") || null,
      provider: String(form.get("provider") ?? ""),
      notes: String(form.get("notes") ?? ""),
      status: String(form.get("status") ?? "pending_review"),
      is_demo: false
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
      <label className="block md:col-span-2">
        <span className="mb-1 block text-sm font-medium">Titulo</span>
        <input name="title" defaultValue={item.title ?? ""} required className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Tipo</span>
        <select name="document_type" defaultValue={item.document_type ?? item.type ?? "other_essential"} className="h-10 w-full rounded-md border border-slate-300 px-3">
          {essentialDocumentTypes().map((option) => <option key={option} value={option}>{labelDocumentType(option)}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Estado</span>
        <select name="status" defaultValue={item.status ?? "pending_review"} className="h-10 w-full rounded-md border border-slate-300 px-3">
          {["pending_review","registered","reviewed","linked","ignored"].map((option) => <option key={option} value={option}>{labelDocumentStatus(option)}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Fecha documento</span>
        <input name="document_date" type="date" defaultValue={dateInputValue(item.document_date)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Fecha vigencia / vencimiento</span>
        <input name="valid_until" type="date" defaultValue={dateInputValue(item.valid_until ?? item.expiration_date)} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Importe documental</span>
        <input name="amount" inputMode="decimal" defaultValue={item.amount === null || item.amount === undefined ? "" : String(item.amount).replace(".", ",")} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Organismo / proveedor</span>
        <input name="provider" defaultValue={item.provider ?? ""} className="h-10 w-full rounded-md border border-slate-300 px-3" />
      </label>
      <label className="block md:col-span-2">
        <span className="mb-1 block text-sm font-medium">Notas</span>
        <textarea name="notes" rows={3} defaultValue={item.notes ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button disabled={pending} className="bg-ink">Guardar cambios</Button>
        <Button type="button" disabled={pending} onClick={onCancel} className="bg-white text-ink hover:bg-slate-50">Cancelar</Button>
      </div>
    </form>
  );
}

function SimpleForm({ title, fields, labels, defaults, pending, onSubmit }: { title: string; fields: string[]; labels: string[]; defaults: Record<string, unknown>; pending: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data: Record<string, unknown> = { ...defaults };
    fields.forEach((field) => {
      const value = String(form.get(field) ?? "");
      data[field] = ["amount", "cost"].includes(field) ? Number(value) : field === "nights" ? Number(value || 0) : value;
    });
    onSubmit(data);
    event.currentTarget.reset();
  }
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold">{title}</h3>
      <form onSubmit={submit} className="space-y-3">
        {fields.map((field, index) => (
          <label key={field} className="block">
            <span className="mb-1 block text-sm font-medium">{labels[index]}</span>
            <input name={field} type={field.includes("date") || field.includes("expiration") || field.includes("check_") ? "date" : ["amount", "cost", "nights"].includes(field) ? "number" : "text"} step="0.01" required className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" />
          </label>
        ))}
        <Button disabled={pending} className="w-full bg-meadow hover:bg-green-700"><Plus className="h-4 w-4" />Crear</Button>
      </form>
    </Card>
  );
}
