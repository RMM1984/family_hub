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
export const getPropertyIncome = (id: string) => withFallback(() => api.get(`/properties/${id}/income`).then((r) => r.data.data), mockIncome.filter((income) => income.property_id === id));
export const getPropertyDocuments = (id: string) => withFallback(() => api.get(`/properties/${id}/documents`).then((r) => r.data.data), mockDocuments.filter((document) => document.property_id === id));
export const createPropertyExpense = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/expenses`, data).then((r) => r.data.data);
export const createPropertyIncome = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/income`, data).then((r) => r.data.data);
export const createPropertyDocument = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/documents`, data).then((r) => r.data.data);
export const getPropertyDrive = (id: string) => withFallback(() => api.get(`/properties/${id}/drive`).then((r) => r.data.data), mockDriveState);
export const connectPropertyDrive = (id: string, data: Record<string, unknown>) => api.post(`/properties/${id}/drive/connect`, data).then((r) => r.data.data);
export const syncPropertyDrive = (id: string) => api.post(`/properties/${id}/drive/sync`).then((r) => r.data.data);
export const updateDriveFile = (propertyId: string, fileId: string, data: Record<string, unknown>) => api.patch(`/properties/${propertyId}/drive/files/${fileId}`, data).then((r) => r.data.data);
export const linkDriveFileExpense = (propertyId: string, fileId: string, expenseId: string) => api.post(`/properties/${propertyId}/drive/files/${fileId}/link-expense`, { expense_id: expenseId }).then((r) => r.data.data);
export const linkDriveFileDocument = (propertyId: string, fileId: string, documentId: string) => api.post(`/properties/${propertyId}/drive/files/${fileId}/link-document`, { document_id: documentId }).then((r) => r.data.data);
