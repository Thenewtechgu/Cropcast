import type { EarthEnvironmentSnapshot, FieldProfile } from '../types';
import { safeJsonFetch } from './httpClient';

export async function fetchFieldEarthMetrics(
  field: FieldProfile
): Promise<EarthEnvironmentSnapshot> {
  const params = new URLSearchParams({
    fieldId: field.id,
    lat: String(field.lat),
    lon: String(field.lon),
    cropName: field.crop.name,
    cropCategory: field.crop.category,
  });
  const { res, data } = await safeJsonFetch<any>(`/api/nasa/environment?${params.toString()}`);
  if (!res.ok) {
    throw new Error(data?.error || 'Không thể tải dữ liệu môi trường NASA.');
  }
  return data as EarthEnvironmentSnapshot;
}

export async function syncFieldEarthMetrics(
  field: FieldProfile,
  rotationId?: string
): Promise<EarthEnvironmentSnapshot> {
  const { res, data } = await safeJsonFetch<any>('/api/nasa/sync-environment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fieldId: field.id,
      lat: field.lat,
      lon: field.lon,
      cropName: field.crop.name,
      cropCategory: field.crop.category,
      rotationId,
    }),
  });
  if (!res.ok) {
    throw new Error(data?.error || 'Đồng bộ dữ liệu NASA thất bại.');
  }
  return data as EarthEnvironmentSnapshot;
}
