import { useEffect, useState, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export type RealtimeEventType =
  | 'SLOT_UPDATED'
  | 'CONTENTION_ALERT'
  | 'CONTENTION_RESOLVED'
  | 'APPOINTMENT_UPDATED'
  | 'APPOINTMENT_APPROVED'
  | 'APPOINTMENT_REJECTED'
  | 'DRIVER_STATUS_UPDATED'
  | 'HOLDS_EXPIRED'
  | 'SYSTEM_RESET';

export interface RealtimeEventPayload {
  event: RealtimeEventType;
  payload: Record<string, any>;
  timestamp: string;
}

export interface PresenceUser {
  id: string;
  name: string;
  role: 'coordinator' | 'driver' | 'admin';
  facilityId?: string;
  onlineAt: string;
}

type EventListener = (event: RealtimeEventType, payload: any) => void;

class SupabaseRealtimeManager {
  private channel: RealtimeChannel | null = null;
  private listeners: Set<EventListener> = new Set();
  private connectionStatus: 'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED' | 'ERROR' = 'DISCONNECTED';
  private statusListeners: Set<(status: 'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED' | 'ERROR') => void> = new Set();
  private presenceUsers: PresenceUser[] = [];
  private presenceListeners: Set<(users: PresenceUser[]) => void> = new Set();
  private lastEvent: RealtimeEventPayload | null = null;
  private lastEventListeners: Set<(event: RealtimeEventPayload) => void> = new Set();
  private reconnectTimer: any = null;
  private currentPresence: PresenceUser | null = null;

  constructor() {
    this.init();
  }

  private init() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      this.setStatus('DISCONNECTED');
      return;
    }

    if (this.channel) {
      return;
    }

    this.setStatus('CONNECTING');

    const channelName = 'setuhaul-realtime';
    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true, self: true },
        presence: { key: 'user-session' },
      },
    });

    // 1. Broadcast event listener (high-speed coordinator & driver events)
    this.channel.on('broadcast', { event: '*' }, (message: any) => {
      const event = (message.event || message.type) as RealtimeEventType;
      const payload = message.payload || {};
      const fullEvent: RealtimeEventPayload = {
        event,
        payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      this.lastEvent = fullEvent;
      this.lastEventListeners.forEach(listener => listener(fullEvent));
      this.listeners.forEach(listener => {
        try {
          listener(event, payload);
        } catch (err) {
          console.error('[Supabase Realtime] Listener error:', err);
        }
      });
    });

    // 2. PostgreSQL replication listeners (row-level changes fallback)
    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dock_slots' },
      (payload: any) => {
        const fullEvent: RealtimeEventPayload = {
          event: 'SLOT_UPDATED',
          payload: {
            slotId: payload.new?.id || payload.old?.id,
            status: payload.new?.status,
            appointmentId: payload.new?.current_appointment_id,
            slot: payload.new,
            source: 'postgres_changes',
          },
          timestamp: new Date().toISOString(),
        };
        this.lastEvent = fullEvent;
        this.lastEventListeners.forEach(l => l(fullEvent));
        this.listeners.forEach(l => l('SLOT_UPDATED', fullEvent.payload));
      }
    );

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'appointments' },
      (payload: any) => {
        const fullEvent: RealtimeEventPayload = {
          event: 'APPOINTMENT_UPDATED',
          payload: {
            appointmentId: payload.new?.id || payload.old?.id,
            status: payload.new?.status,
            driverId: payload.new?.driver_id,
            slotId: payload.new?.slot_id,
            appointment: payload.new,
            source: 'postgres_changes',
          },
          timestamp: new Date().toISOString(),
        };
        this.lastEvent = fullEvent;
        this.lastEventListeners.forEach(l => l(fullEvent));
        this.listeners.forEach(l => l('APPOINTMENT_UPDATED', fullEvent.payload));
      }
    );

    // 3. Supabase Realtime Presence tracking
    this.channel.on('presence', { event: 'sync' }, () => {
      if (!this.channel) return;
      const state = this.channel.presenceState();
      const users: PresenceUser[] = [];
      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => {
          if (p.id) {
            users.push({
              id: p.id,
              name: p.name || 'User',
              role: p.role || 'driver',
              facilityId: p.facilityId,
              onlineAt: p.onlineAt || new Date().toISOString(),
            });
          }
        });
      });
      this.presenceUsers = users;
      this.presenceListeners.forEach(l => l(users));
    });

    // 4. Subscription lifecycle
    this.channel.subscribe((status: string, err?: any) => {
      if (status === 'SUBSCRIBED') {
        this.setStatus('SUBSCRIBED');
        if (this.currentPresence) {
          this.channel?.track(this.currentPresence);
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.warn('[Supabase Realtime] Channel Error:', err);
        this.setStatus('ERROR');
        this.scheduleReconnect();
      } else if (status === 'TIMED_OUT') {
        this.setStatus('DISCONNECTED');
        this.scheduleReconnect();
      } else if (status === 'CLOSED') {
        this.setStatus('DISCONNECTED');
      }
    });
  }

  private setStatus(status: 'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED' | 'ERROR') {
    this.connectionStatus = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.channel) {
        const supabase = getSupabaseClient();
        if (supabase) {
          supabase.removeChannel(this.channel);
        }
        this.channel = null;
      }
      this.init();
    }, 5000);
  }

  public getStatus() {
    return this.connectionStatus;
  }

  public getPresenceUsers() {
    return this.presenceUsers;
  }

  public getLastEvent() {
    return this.lastEvent;
  }

  public addListener(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public addStatusListener(listener: (status: 'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED' | 'ERROR') => void): () => void {
    this.statusListeners.add(listener);
    listener(this.connectionStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public addPresenceListener(listener: (users: PresenceUser[]) => void): () => void {
    this.presenceListeners.add(listener);
    listener(this.presenceUsers);
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  public addLastEventListener(listener: (event: RealtimeEventPayload) => void): () => void {
    this.lastEventListeners.add(listener);
    if (this.lastEvent) {
      listener(this.lastEvent);
    }
    return () => {
      this.lastEventListeners.delete(listener);
    };
  }

  public async broadcast(event: RealtimeEventType, payload: Record<string, any>): Promise<boolean> {
    if (!this.channel) {
      this.init();
    }
    try {
      if (!this.channel) return false;
      const resp = await this.channel.send({
        type: 'broadcast',
        event,
        payload: {
          ...payload,
          timestamp: new Date().toISOString(),
        },
      });
      return resp === 'ok';
    } catch (err) {
      console.warn('[Supabase Realtime] Broadcast failed:', err);
      return false;
    }
  }

  public async trackPresence(user: { id: string; name: string; role: 'coordinator' | 'driver' | 'admin'; facilityId?: string }) {
    this.currentPresence = {
      ...user,
      onlineAt: new Date().toISOString(),
    };
    if (this.channel && this.connectionStatus === 'SUBSCRIBED') {
      await this.channel.track(this.currentPresence);
    }
  }
}

export const realtimeManager = new SupabaseRealtimeManager();

/**
 * React Hook for Supabase Realtime WebSocket synchronization
 */
export function useSupabaseRealtime(options?: {
  onEvent?: (event: RealtimeEventType, payload: any) => void;
  userProfile?: { id: string; fullName: string; role: string; facilityId?: string } | null;
}) {
  const [status, setStatus] = useState<'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED' | 'ERROR'>(
    realtimeManager.getStatus()
  );
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>(
    realtimeManager.getPresenceUsers()
  );
  const [lastEvent, setLastEvent] = useState<RealtimeEventPayload | null>(
    realtimeManager.getLastEvent()
  );

  const onEventRef = useRef(options?.onEvent);
  useEffect(() => {
    onEventRef.current = options?.onEvent;
  }, [options?.onEvent]);

  // Subscribe to status and event streams
  useEffect(() => {
    const unsubStatus = realtimeManager.addStatusListener(setStatus);
    const unsubPresence = realtimeManager.addPresenceListener(setPresenceUsers);
    const unsubLastEvent = realtimeManager.addLastEventListener(setLastEvent);

    const unsubEvent = realtimeManager.addListener((event, payload) => {
      if (onEventRef.current) {
        onEventRef.current(event, payload);
      }
    });

    return () => {
      unsubStatus();
      unsubPresence();
      unsubLastEvent();
      unsubEvent();
    };
  }, []);

  // Track current user presence
  useEffect(() => {
    if (options?.userProfile?.id) {
      realtimeManager.trackPresence({
        id: options.userProfile.id,
        name: options.userProfile.fullName || 'User',
        role: (options.userProfile.role as any) || 'driver',
        facilityId: options.userProfile.facilityId,
      });
    }
  }, [options?.userProfile?.id, options?.userProfile?.role]);

  const broadcast = useCallback(
    async (event: RealtimeEventType, payload: Record<string, any>) => {
      return realtimeManager.broadcast(event, payload);
    },
    []
  );

  return {
    status,
    isConnected: status === 'SUBSCRIBED',
    presenceUsers,
    activePeersCount: presenceUsers.length,
    lastEvent,
    broadcast,
  };
}
