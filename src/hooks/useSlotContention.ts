import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ContestedSlotResult, ContentionQueryResponse } from '../db/supabaseService';
import { useSupabaseRealtime } from '../lib/realtimeService';

export interface UseSlotContentionOptions {
  facilityId?: string;
  autoRefetchOnRealtime?: boolean;
  pollIntervalMs?: number;
  onContentionDetected?: (contestedSlots: ContestedSlotResult[]) => void;
}

export interface SlotContentionSummary {
  slot_id: string;
  is_contested: boolean;
  request_count: number;
  competing_driver_names: string[];
  recommended_driver_name?: string;
}

export interface UseSlotContentionReturn {
  // Flagged slots where requests > 1
  contestedSlots: ContestedSlotResult[];
  flaggedSlotIds: string[];
  slotContentionMap: Record<string, SlotContentionSummary>;

  // Fast helper queries
  isSlotContested: (slotId: string) => boolean;
  getSlotRequestCount: (slotId: string) => number;
  getSlotContention: (slotId: string) => ContestedSlotResult | undefined;

  // Aggregate stats
  totalContestedSlots: number;
  totalContestedRequests: number;
  hasContention: boolean;

  // Status & Actions
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<ContentionQueryResponse | null>;
  resolveContention: (params: {
    slotId: string;
    approvedAppointmentId: string;
    confirmationRef: string;
    alternativeSlotId?: string | null;
    rejectedAppointmentIds?: string[];
  }) => Promise<{ success: boolean; message: string }>;
  simulateContention: (targetSlotId?: string) => Promise<{ success: boolean; message: string }>;
}

/**
 * Contention Logic Hook:
 * Queries and flags dock slots where requests > 1.
 * Provides O(1) contention checking per slot, live WebSocket updates,
 * and automated decision-support recommendations.
 */
export function useSlotContention(
  optionsOrFacilityId?: UseSlotContentionOptions | string
): UseSlotContentionReturn {
  const options: UseSlotContentionOptions =
    typeof optionsOrFacilityId === 'string'
      ? { facilityId: optionsOrFacilityId }
      : optionsOrFacilityId || {};

  const facilityId = options.facilityId || 'FAC_JAI_01';
  const autoRefetchOnRealtime = options.autoRefetchOnRealtime !== false;
  const pollIntervalMs = options.pollIntervalMs || 30000;

  const [contestedSlots, setContestedSlots] = useState<ContestedSlotResult[]>([]);
  const [flaggedSlotIds, setFlaggedSlotIds] = useState<string[]>([]);
  const [slotContentionMap, setSlotContentionMap] = useState<Record<string, SlotContentionSummary>>({});
  const [totalContestedSlots, setTotalContestedSlots] = useState<number>(0);
  const [totalContestedRequests, setTotalContestedRequests] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const prevContestedCountRef = useRef<number>(0);

  // Query Supabase backend for slots where requests > 1
  const fetchContestedSlots = useCallback(async (): Promise<ContentionQueryResponse | null> => {
    try {
      setError(null);
      const res = await fetch(`/api/supabase/contention-slots?facilityId=${encodeURIComponent(facilityId)}`);
      if (!res.ok) {
        throw new Error(`Contention query failed with status: ${res.status}`);
      }

      const data: ContentionQueryResponse = await res.json();

      setContestedSlots(data.contested_slots || []);
      setFlaggedSlotIds(data.flagged_slot_ids || []);
      setSlotContentionMap(data.slot_contention_map || {});
      setTotalContestedSlots(data.total_contested_slots || 0);
      setTotalContestedRequests(data.total_contested_requests || 0);
      setLastUpdated(new Date());

      // Trigger callback if new contention appeared
      if (
        options.onContentionDetected &&
        data.total_contested_slots > prevContestedCountRef.current &&
        data.contested_slots.length > 0
      ) {
        options.onContentionDetected(data.contested_slots);
      }
      prevContestedCountRef.current = data.total_contested_slots || 0;

      return data;
    } catch (err: any) {
      console.error('[useSlotContention] Error executing query:', err);
      setError(err.message || 'Failed to query contested slots');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, options.onContentionDetected]);

  // Initial fetch and interval fallback
  useEffect(() => {
    setIsLoading(true);
    fetchContestedSlots();

    if (pollIntervalMs > 0) {
      const interval = setInterval(fetchContestedSlots, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchContestedSlots, pollIntervalMs]);

  // Supabase Realtime WebSocket subscription: instant re-evaluation on any contention event
  useSupabaseRealtime({
    onEvent: (event) => {
      if (!autoRefetchOnRealtime) return;
      if (
        event === 'CONTENTION_ALERT' ||
        event === 'CONTENTION_RESOLVED' ||
        event === 'SLOT_UPDATED' ||
        event === 'APPOINTMENT_UPDATED' ||
        event === 'SYSTEM_RESET'
      ) {
        fetchContestedSlots();
      }
    },
  });

  // Fast O(1) helper set
  const flaggedSet = useMemo(() => new Set(flaggedSlotIds), [flaggedSlotIds]);

  // Helper: check if a specific slot is contested (requests > 1)
  const isSlotContested = useCallback(
    (slotId: string): boolean => {
      return flaggedSet.has(slotId);
    },
    [flaggedSet]
  );

  // Helper: get the exact request count for a slot
  const getSlotRequestCount = useCallback(
    (slotId: string): number => {
      if (slotContentionMap[slotId]) {
        return slotContentionMap[slotId].request_count;
      }
      return flaggedSet.has(slotId) ? 2 : 0;
    },
    [slotContentionMap, flaggedSet]
  );

  // Helper: get full contention detail for a specific slot
  const getSlotContention = useCallback(
    (slotId: string): ContestedSlotResult | undefined => {
      return contestedSlots.find((s) => s.slot_id === slotId);
    },
    [contestedSlots]
  );

  // Resolve contention action
  const resolveContention = useCallback(
    async (params: {
      slotId: string;
      approvedAppointmentId: string;
      confirmationRef: string;
      alternativeSlotId?: string | null;
      rejectedAppointmentIds?: string[];
    }): Promise<{ success: boolean; message: string }> => {
      try {
        const res = await fetch('/api/supabase/resolve-contention', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotId: params.slotId,
            approvedAppointmentId: params.approvedAppointmentId,
            coordinatorId: 'COORD_DISPATCH_LEAD',
            confirmationRef: params.confirmationRef,
            alternativeSlotId: params.alternativeSlotId || null,
            rejectedAppointmentIds: params.rejectedAppointmentIds || [],
          }),
        });

        const data = await res.json();
        if (!res.ok || data.status === 'error') {
          return { success: false, message: data.message || 'Failed to resolve contention' };
        }

        // Optimistically remove resolved slot from flagged state
        setFlaggedSlotIds((prev) => prev.filter((id) => id !== params.slotId));
        setContestedSlots((prev) => prev.filter((s) => s.slot_id !== params.slotId));
        setTotalContestedSlots((prev) => Math.max(0, prev - 1));

        // Background refetch for full database consistency
        fetchContestedSlots();

        return { success: true, message: data.message || 'Contention resolved successfully' };
      } catch (err: any) {
        return { success: false, message: err.message || 'Network error resolving contention' };
      }
    },
    [fetchContestedSlots]
  );

  // Simulate contention: trigger concurrent driver requests to verify requests > 1 logic
  const simulateContention = useCallback(
    async (targetSlotId?: string): Promise<{ success: boolean; message: string }> => {
      try {
        // Fetch current available slots if target not specified
        let slotId = targetSlotId;
        if (!slotId) {
          const slotsRes = await fetch(`/api/supabase/slots?facilityId=${facilityId}`);
          const slotsData = await slotsRes.json();
          const availableSlot = (slotsData.slots || []).find((s: any) => s.status === 'AVAILABLE');
          if (!availableSlot) {
            return {
              success: false,
              message: 'No AVAILABLE slot found to simulate contention. Reset demo database or pick another slot.',
            };
          }
          slotId = availableSlot.id;
        }

        const now = Date.now();

        // Concurrently dispatch two driver booking requests for the exact same slot
        const [req1, req2] = await Promise.all([
          fetch('/api/supabase/book-slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slotId,
              shipmentId: `SHP-ALPHA-${now}`,
              driverId: 'DRV_SIM_01',
              driverName: 'Rajesh Sharma',
              facilityId,
              cargoType: 'PERISHABLE',
              urgencyLevel: 'HIGH',
              etaConfidenceScore: 94,
              vehicleRegistration: 'RJ14-GB-9921',
            }),
          }),
          fetch('/api/supabase/book-slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slotId,
              shipmentId: `SHP-BETA-${now}`,
              driverId: 'DRV_SIM_02',
              driverName: 'Vikram Singh',
              facilityId,
              cargoType: 'GENERAL',
              urgencyLevel: 'MEDIUM',
              etaConfidenceScore: 78,
              vehicleRegistration: 'HR26-CT-4410',
            }),
          }),
        ]);

        await Promise.all([req1.json(), req2.json()]);

        // Re-query to flag slot where requests > 1
        await fetchContestedSlots();

        return {
          success: true,
          message: `Simulated 2 concurrent requests on slot ${slotId}. Slot successfully flagged as Contested (requests > 1)!`,
        };
      } catch (err: any) {
        return { success: false, message: err.message || 'Failed to simulate contention' };
      }
    },
    [facilityId, fetchContestedSlots]
  );

  return {
    contestedSlots,
    flaggedSlotIds,
    slotContentionMap,
    isSlotContested,
    getSlotRequestCount,
    getSlotContention,
    totalContestedSlots,
    totalContestedRequests,
    hasContention: totalContestedSlots > 0,
    isLoading,
    error,
    lastUpdated,
    refetch: fetchContestedSlots,
    resolveContention,
    simulateContention,
  };
}

// Aliases for developer convenience
export const useContentionSlots = useSlotContention;
export const useContentionLogic = useSlotContention;
