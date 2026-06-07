"use client";

import axios from "axios";
import { mockDashboard, mockDocuments, mockDriveState, mockExpenses, mockIncome, mockProperties } from "./mock";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
});

api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("hogarflow_token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function withFallback<T>(fn: () => Promise<T>, fallback: T) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function login(email: string, password: string) {
  const response = await api.post("/auth/login", { email, password });
  localStorage.setItem("hogarflow_token", response.data.data.token);
  return response.data.data;
}

export const getDashboard = () => withFallback(() => api.get("/dashboard/summary").then((r) => r.data.data), mockDashboard);
export const getProperties = () => withFallback(() => api.get("/properties").then((r) => r.data.data), mockProperties);
export const getProperty = (id: string) => withFallback(() => api.get(`/properties/${id}`).then((r) => r.data.data), mockProperties.find((property) => property.id === id) ?? mockProperties[0]);
export const getExpenses = () => withFallback(() => api.get("/expenses").then((r) => r.data.data), mockExpenses);
export const getIncome = () => withFallback(() => api.get("/income").then((r) => r.data.data), mockIncome);
export const getDocuments = () => withFallback(() => api.get("/documents").then((r) => r.data.data), mockDocuments);
export const getPropertyExpenses = (id: string) => withFallback(() => api.get(`/properties/${id}/expenses`).then((r) => r.data.data), mockExpenses.filter((expense) => expense.property_id === id));
export const getPropertyGroupedIncome = (id: string, year: number) => api.get(`/properties/${id}/income/grouped`, { params: { year } }).then((r) => r.data.data);
export const getPropertyGroupedExpenses = (id: string, year: number) => api.get(`/properties/${id}/expenses/grouped`, { params: { year } }).then((r) => r.data.data);
export const getPropertyGroupedDocuments = (id: string, year: number) => api.get(`/properties/${id}/documents/grouped`, { params: { year } }).then((r) => r.data.data);
export const getPropertyEssentialDocuments = (id: string, year: number) => api.get(`/properties/${id}/documents/essential`, { params: { year } }).then((r) => r.data.data);
export const getPropertyFinancing = (id: string, year: number) => api.get(`/properties/${id}/financing`, { params: { year } }).then((r) => r.data.data);
export const getPropertyMonthlyExpenses = (id: string, month: string) => api.get(`/properties/${id}/expenses/monthly`, { params: { month } }).then((r) => r.data.data);
export const savePropertyMonthlyExpenses = (id: string, data: Record<string, unknown>) => api.put(`/properties/${id}/expenses/monthly`, data).then((r) => r.data.data);
export const getPropertyMonthlyStats = (id: string, year: number) => api.get(`/properties/${id}/stats/monthly`, { params: { year } }).then((r) => r.data.data);
export const getPropertyIncome = (id: string) => withFallback(() => api.get(`/properties/${id}/income`).then((r) => r.data.data), mockIncome.filter((income) => income.property_id === id));
export const getPropertyDocuments = (id: string) => withFallback(() => api.get(`/properties/${id}/documents`).then((r) => r.data.data), mockDocuments.filter((document) => document.property_id === id));
export const createPropertyExpense = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/expenses`, data).then((r) => r.data.data);
export const createPropertyIncome = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/income`, data).then((r) => r.data.data);
export const updatePropertyIncome = (propertyId: string, incomeId: string, data: Record<string, unknown>) => api.patch(`/properties/${propertyId}/income/${incomeId}`, data).then((r) => r.data.data);
export const createPropertyDocument = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/documents`, data).then((r) => r.data.data);
export const updatePropertyDocument = (propertyId: string, documentId: string, data: Record<string, unknown>) => api.patch(`/properties/${propertyId}/documents/${documentId}`, data).then((r) => r.data.data);
export const createPropertyFinancing = (propertyId: string, data: Record<string, unknown>) => api.post(`/properties/${propertyId}/financing`, data).then((r) => r.data.data);
export const updatePropertyFinancing = (propertyId: string, paymentId: string, data: Record<string, unknown>) => api.patch(`/properties/${propertyId}/financing/${paymentId}`, data).then((r) => r.data.data);
export const deletePropertyFinancing = (propertyId: string, paymentId: string) => api.delete(`/properties/${propertyId}/financing/${paymentId}`).then((r) => r.data.data);
export const registerDocumentExpense = (propertyId: string, documentId: string, data: Record<string, unknown>) => api.post(`/properties/${propertyId}/documents/${documentId}/register-expense`, data).then((r) => r.data.data);
export const registerDocumentIncome = (propertyId: string, documentId: string, data: Record<string, unknown>) => api.post(`/properties/${propertyId}/documents/${documentId}/register-income`, data).then((r) => r.data.data);
export const updatePropertyOperation = (id: string, data: Record<string, unknown>) => api.patch(`/properties/${id}/operation`, data).then((r) => r.data.data);
export const getPropertyReservations = (id: string) => withFallback(() => api.get(`/properties/${id}/reservations`).then((r) => r.data.data), []);
export const getPropertyAirbnbStats = (id: string) => withFallback(() => api.get(`/properties/${id}/airbnb/stats`).then((r) => r.data.data), {
  reservations_total: 0,
  upcoming_reservations: 0,
  next_check_in: null,
  next_check_out: null,
  booked_nights_current_month: 0,
  booked_nights_next_30_days: 0,
  occupancy_current_month: 0,
  occupancy_next_30_days: 0,
  incomes_missing_amount: 0
});
export const savePropertyAirbnbIcal = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/airbnb/ical`, data).then((r) => r.data.data);
export const syncPropertyAirbnb = (id: string) => api.post(`/properties/${id}/airbnb/sync`).then((r) => r.data.data);
export const disconnectPropertyAirbnb = (id: string) => api.delete(`/properties/${id}/airbnb/ical`).then((r) => r.data.data);
export const importAirbnbEarningsCsv = (id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post(`/properties/${id}/airbnb/earnings/import-csv`, form).then((r) => r.data.data);
};
export const getAirbnbEarningsImport = (propertyId: string, importId: string) => api.get(`/properties/${propertyId}/airbnb/earnings/imports/${importId}`).then((r) => r.data.data);
export const applyAirbnbEarningsImport = (propertyId: string, importId: string, data: Record<string, unknown> = {}) => api.post(`/properties/${propertyId}/airbnb/earnings/imports/${importId}/apply`, data).then((r) => r.data.data);
export const createReservationIncome = (propertyId: string, reservationId: string, data: Record<string, unknown>) => api.post(`/properties/${propertyId}/reservations/${reservationId}/create-income`, data).then((r) => r.data.data);
export const updateReservationAmount = (propertyId: string, reservationId: string, data: Record<string, unknown>) => api.patch(`/properties/${propertyId}/reservations/${reservationId}/amount`, data).then((r) => r.data.data);
export const updateReservationGuestCount = (propertyId: string, reservationId: string, data: Record<string, unknown>) => api.patch(`/properties/${propertyId}/reservations/${reservationId}/guest-count`, data).then((r) => r.data.data);
export const updatePropertyReservation = (propertyId: string, reservationId: string, data: Record<string, unknown>) => api.patch(`/properties/${propertyId}/reservations/${reservationId}`, data).then((r) => r.data.data);
export const getPropertyDrive = (id: string) => withFallback(() => api.get(`/properties/${id}/drive`).then((r) => r.data.data), mockDriveState);
export const getPropertyDriveAuthUrl = (id: string) => api.get(`/properties/${id}/drive/auth-url`).then((r) => r.data.data as { url: string; scope: string });
export const getAvailableDriveFolders = (id: string) => api.get(`/properties/${id}/drive/available-folders`).then((r) => r.data.data);
export const connectPropertyDrive = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/drive/connect`, data).then((r) => r.data.data);
export const syncPropertyDrive = (id: string) => api.post(`/properties/${id}/drive/sync`).then((r) => r.data.data);
export const syncAllPropertyDrive = (id: string) => api.post(`/properties/${id}/drive/sync-all`).then((r) => r.data.data);
export const createDriveFolder = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/drive/folders`, data).then((r) => r.data.data);
export const updateDriveFolder = (propertyId: string, folderId: string, data: Record<string, unknown>) => api.patch(`/properties/${propertyId}/drive/folders/${folderId}`, data).then((r) => r.data.data);
export const deleteDriveFolder = (propertyId: string, folderId: string) => api.delete(`/properties/${propertyId}/drive/folders/${folderId}`).then((r) => r.data.data);
export const syncDriveFolder = (propertyId: string, folderId: string) => api.post(`/properties/${propertyId}/drive/folders/${folderId}/sync`).then((r) => r.data.data);
export const updateDriveFile = (propertyId: string, fileId: string, data: Record<string, unknown>) => api.patch(`/properties/${propertyId}/drive/files/${fileId}`, data).then((r) => r.data.data);
export const linkDriveFileExpense = (propertyId: string, fileId: string, expenseId: string) => api.post(`/properties/${propertyId}/drive/files/${fileId}/link-expense`, { expense_id: expenseId }).then((r) => r.data.data);
export const linkDriveFileDocument = (propertyId: string, fileId: string, documentId: string) => api.post(`/properties/${propertyId}/drive/files/${fileId}/link-document`, { document_id: documentId }).then((r) => r.data.data);
export const registerDriveFileExpense = (propertyId: string, fileId: string, data: Record<string, unknown>) => api.post(`/properties/${propertyId}/drive/files/${fileId}/register-expense`, data).then((r) => r.data.data);
export const saveDriveFileDocument = (propertyId: string, fileId: string, data: Record<string, unknown>) => api.post(`/properties/${propertyId}/drive/files/${fileId}/save-document`, data).then((r) => r.data.data);
export const disconnectPropertyDrive = (propertyId: string) => api.delete(`/properties/${propertyId}/drive/disconnect`).then((r) => r.data.data);
export const getConnections = () => withFallback(() => api.get("/connections").then((r) => r.data.data), { google_drive: { configured: false, scope: "", connections: [] }, airbnb_ical: { configured: true, method: "ical_per_property", connections: [] } });
export const getGoogleDriveFolders = () => withFallback(() => api.get("/connections/google-drive/folders").then((r) => r.data.data), []);
