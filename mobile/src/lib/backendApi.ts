import { Capacitor } from "@capacitor/core";
import { ALL_CFA_POINTS, type PointName } from "../data/cfaSchema";
import type { SkeletonCoordinates, SkeletonRecord } from "../types";
import { toBackendLandmarks } from "./backendCoordinates";

const BACKEND_TIMEOUT_MS = 7_000;
const WORKSPACE_MARKER = "Created by Skeletal Coordinate App";
const POINT_NAMES = new Set<string>(ALL_CFA_POINTS);

export type BackendConnectionState = "checking" | "online" | "offline" | "syncing";

export interface BackendGraveyard {
  graveyard_id: string;
  name: string;
  location: string | null;
  description: string | null;
  created_at: string;
}

export interface BackendCoordinate {
  coordinate_id: string;
  skeleton_id: string;
  joint_name: string;
  x: number;
  y: number;
  z: number;
}

export interface BackendCoordinateInput {
  joint_name: string;
  x: number;
  y: number;
  z: number;
}

export interface BackendSkeleton {
  skeleton_id: string;
  graveyard_id: string;
  name: string | null;
  description: string | null;
  pos_x: number | null;
  pos_y: number | null;
  pos_z: number | null;
  created_at: string;
  updated_at: string;
  coordinates?: BackendCoordinate[];
}

export class BackendApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

function trimBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getBackendBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_URL;
  if (configuredUrl?.trim()) return trimBaseUrl(configuredUrl);
  return Capacitor.getPlatform() === "android"
    ? "http://10.0.2.2:8000"
    : "http://127.0.0.1:8000";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    if (!response.ok) {
      let detail = `Backend request failed (${response.status})`;
      try {
        const body = await response.json() as { detail?: unknown };
        if (typeof body.detail === "string") detail = body.detail;
      } catch {
        // Keep the status-based message when the response is not JSON.
      }
      throw new BackendApiError(detail, response.status);
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof BackendApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BackendApiError("Backend connection timed out");
    }
    throw new BackendApiError(error instanceof Error ? error.message : "Backend is unavailable");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkBackendConnection(): Promise<void> {
  await request<BackendGraveyard[]>("/graveyards/");
}

export async function ensureWorkspaceGraveyard(
  workspaceName: string,
  savedGraveyardId?: string,
): Promise<BackendGraveyard> {
  const name = workspaceName.trim().slice(0, 255) || "Skeletal Model Workspace";

  if (savedGraveyardId) {
    try {
      const existing = await request<BackendGraveyard>(`/graveyards/${savedGraveyardId}`);
      if (existing.name === name && existing.description === WORKSPACE_MARKER) return existing;
      return await request<BackendGraveyard>(`/graveyards/${savedGraveyardId}`, {
        method: "PUT",
        body: JSON.stringify({ name, description: WORKSPACE_MARKER }),
      });
    } catch (error) {
      if (!(error instanceof BackendApiError) || error.status !== 404) throw error;
    }
  }

  const graveyards = await request<BackendGraveyard[]>("/graveyards/");
  const matchingGraveyard = graveyards.find(
    (graveyard) => graveyard.name === name && graveyard.description === WORKSPACE_MARKER,
  );
  if (matchingGraveyard) return matchingGraveyard;

  return await request<BackendGraveyard>("/graveyards/", {
    method: "POST",
    body: JSON.stringify({ name, description: WORKSPACE_MARKER }),
  });
}

export function recordToCoordinatePayloads(record: SkeletonRecord): BackendCoordinateInput[] {
  return toBackendLandmarks(record).map((landmark) => ({
    joint_name: landmark.id,
    x: landmark.position[0],
    y: landmark.position[1],
    z: landmark.position[2],
  }));
}

async function createSkeleton(record: SkeletonRecord, graveyardId: string): Promise<BackendSkeleton> {
  return await request<BackendSkeleton>("/skeletons/", {
    method: "POST",
    body: JSON.stringify({
      graveyard_id: graveyardId,
      name: record.name.trim().slice(0, 255) || "Untitled skeleton",
      description: record.notes,
    }),
  });
}

async function getSkeleton(skeletonId: string): Promise<BackendSkeleton> {
  return await request<BackendSkeleton>(`/skeletons/${skeletonId}`);
}

export async function syncSkeletonRecord(
  record: SkeletonRecord,
  graveyardId: string,
): Promise<BackendSkeleton> {
  let skeleton: BackendSkeleton | null = null;

  if (record.backendId) {
    try {
      skeleton = await getSkeleton(record.backendId);
    } catch (error) {
      if (!(error instanceof BackendApiError) || error.status !== 404) throw error;
    }
  }

  if (!skeleton || skeleton.graveyard_id !== graveyardId) {
    skeleton = await createSkeleton(record, graveyardId);
  } else {
    await request<BackendSkeleton>(`/skeletons/${skeleton.skeleton_id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: record.name.trim().slice(0, 255) || "Untitled skeleton",
        description: record.notes,
      }),
    });
  }

  const current = await getSkeleton(skeleton.skeleton_id);
  const remoteCoordinates = current.coordinates ?? [];
  const desiredCoordinates = recordToCoordinatePayloads(record);
  const desiredByJoint = new Map(desiredCoordinates.map((coordinate) => [coordinate.joint_name, coordinate]));
  const remoteByJoint = new Map(remoteCoordinates.map((coordinate) => [coordinate.joint_name, coordinate]));

  await Promise.all(remoteCoordinates.map(async (remoteCoordinate) => {
    const desiredCoordinate = desiredByJoint.get(remoteCoordinate.joint_name);
    if (!desiredCoordinate) {
      // Preserve backend landmarks introduced by another client or schema.
      if (!POINT_NAMES.has(remoteCoordinate.joint_name)) return;
      await request<{ status: string }>(
        `/skeletons/${current.skeleton_id}/coordinates/${remoteCoordinate.coordinate_id}`,
        { method: "DELETE" },
      );
      return;
    }

    await request<BackendCoordinate>(
      `/skeletons/${current.skeleton_id}/coordinates/${remoteCoordinate.coordinate_id}`,
      { method: "PUT", body: JSON.stringify(desiredCoordinate) },
    );
  }));

  const newCoordinates = desiredCoordinates.filter((coordinate) => !remoteByJoint.has(coordinate.joint_name));
  if (newCoordinates.length > 0) {
    await request<BackendCoordinate[]>(`/skeletons/${current.skeleton_id}/coordinates/bulk`, {
      method: "POST",
      body: JSON.stringify(newCoordinates),
    });
  }

  return await getSkeleton(current.skeleton_id);
}

export async function loadGraveyardSkeletons(graveyardId: string): Promise<BackendSkeleton[]> {
  const skeletons = await request<BackendSkeleton[]>(`/graveyards/${graveyardId}/skeletons`);
  return await Promise.all(skeletons.map((skeleton) => getSkeleton(skeleton.skeleton_id)));
}

export function backendSkeletonToRecord(
  skeleton: BackendSkeleton,
  existingRecord?: SkeletonRecord,
): SkeletonRecord {
  const coordinates: SkeletonCoordinates = {};
  (skeleton.coordinates ?? []).forEach((coordinate) => {
    if (!POINT_NAMES.has(coordinate.joint_name)) return;
    coordinates[coordinate.joint_name as PointName] = [coordinate.x, coordinate.y, coordinate.z];
  });

  return {
    id: existingRecord?.id ?? `skeleton-record-${crypto.randomUUID()}`,
    name: skeleton.name?.trim() || "Untitled skeleton",
    coordinates,
    excludedGroups: existingRecord?.excludedGroups ?? [],
    notes: skeleton.description ?? "",
    backendId: skeleton.skeleton_id,
    lastSyncedAt: new Date().toISOString(),
  };
}
