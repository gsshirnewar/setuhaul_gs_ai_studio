export interface Coordinator {
  coordinator_id: string;
  name: string;
  phone: string;
  email: string;
  password?: string;
  facility_id: string;
  role_title: string;
  status: 'ACTIVE' | 'ON_DUTY' | 'OFF_DUTY';
  shift_hours: string;
}

export interface Facility {
  facility_id: string;
  facility_name: string;
  city: string;
  state: string;
  timezone: string;
  open_time: string;
  close_time: string;
  checkin_grace_min: number;
  default_unload_min: number;
  active_flag: number;
}

export interface Dock {
  dock_id: string;
  facility_id: string;
  dock_code: string;
  dock_type: 'STANDARD' | 'REEFER' | 'HEAVY';
  supports_refrigerated: number;
  max_vehicle_weight_kg: number;
  dock_status: 'ACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE' | 'INACTIVE';
}

export interface FacilityRule {
  rule_id: string;
  facility_id: string;
  rule_type: string;
  rule_value: string;
  description: string;
  effective_from: string;
  effective_to?: string | null;
  active_flag: number;
}

export interface DockStatusEvent {
  dock_event_id: string;
  dock_id: string;
  event_type: 'MAINTENANCE' | 'BREAKDOWN' | 'CAPACITY_REDUCTION' | 'REOPENED' | 'MANUAL_BLOCK';
  event_start_ts: string;
  event_end_ts: string | null;
  reason: string;
  created_at: string;
}

export interface Carrier {
  carrier_id: string;
  carrier_name: string;
  contact_email: string;
  contact_phone: string;
  active_flag: number;
}

export interface Driver {
  driver_id: string;
  carrier_id: string;
  driver_name: string;
  email: string;
  password?: string;
  phone: string;
  licence_number: string;
  home_base_city: string;
  driver_status: 'ACTIVE' | 'OFF_DUTY' | 'SUSPENDED' | 'INACTIVE';
  verification_status?: 'VERIFIED' | 'PENDING' | 'REJECTED';
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  vehicle_registration?: string;
  registered_at?: string;
  approved_by?: string;
  approved_at?: string;
  verified_by?: string;
  verified_at?: string;
  rejection_reason?: string;
}

export interface Vehicle {
  vehicle_id: string;
  carrier_id: string;
  vehicle_type_code: string;
  registration_number: string;
  capacity_kg: number;
  refrigeration_capable: number;
  active_flag: number;
}

export interface VehicleType {
  vehicle_type_code: string;
  description: string;
  default_capacity_kg: number;
  refrigerated_flag: number;
  typical_dock_type: 'STANDARD' | 'REEFER' | 'HEAVY' | 'ANY';
}

export interface Shipment {
  shipment_id: string;
  order_reference: string;
  carrier_id: string;
  driver_id: string;
  vehicle_id: string;
  origin_name: string;
  origin_city: string;
  destination_facility_id: string;
  customer_name: string;
  product_category: string;
  load_weight_kg: number;
  pallet_count: number | null;
  required_dock_type: 'ANY' | 'STANDARD' | 'REEFER' | 'HEAVY';
  temperature_control_required: number;
  priority_code: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  planned_departure_ts: string;
  actual_departure_ts: string | null;
  original_eta_ts: string;
  latest_eta_ts: string | null;
  expected_unload_min: number;
  current_status: 'PLANNED' | 'ASSIGNED' | 'IN_TRANSIT' | 'AT_GATE' | 'WAITING' | 'IN_DOCK' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

export interface AppointmentSlot {
  slot_id: string;
  facility_id: string;
  dock_id: string;
  slot_start_ts: string;
  slot_end_ts: string;
  slot_status: 'OPEN' | 'BLOCKED' | 'CLOSED';
  block_reason: string | null;
  created_at: string;
}

export interface Appointment {
  appointment_id: string;
  shipment_id: string;
  slot_id: string;
  appointment_status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'REJECTED';
  booking_source: 'PLANNER' | 'DRIVER_CHAT' | 'WAREHOUSE' | 'SCHEDULING_TOOL' | 'MANUAL_OVERRIDE';
  is_current: number;
  booked_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  replaced_appointment_id: string | null;
  warehouse_confirmation_ref: string | null;
  approved_by_coordinator_id?: string | null;
  approved_by_name?: string | null;
  rejected_by_coordinator_id?: string | null;
  rejected_by_name?: string | null;
  rejection_reason?: string | null;
  coordinator_notes?: string | null;
  updated_at: string;
}

export interface ETAUpdate {
  eta_update_id: string;
  shipment_id: string;
  source_type: 'ORIGINAL_PLAN' | 'DRIVER_DECLARED' | 'OPERATIONS_OVERRIDE' | 'WAREHOUSE_ESTIMATE';
  reported_by_driver_id: string | null;
  declared_eta_ts: string;
  confidence_code: 'LOW' | 'MEDIUM' | 'HIGH';
  delay_reason_code: string | null;
  note: string | null;
  created_at: string;
}

export interface FacilityCheckin {
  checkin_id: string;
  shipment_id: string;
  facility_id: string;
  gate_in_ts: string | null;
  yard_queue_enter_ts: string | null;
  dock_in_ts: string | null;
  unload_start_ts: string | null;
  unload_end_ts: string | null;
  gate_out_ts: string | null;
  arrival_state: 'EARLY' | 'ON_TIME' | 'LATE' | 'NO_SHOW' | null;
  queue_state: 'NOT_QUEUED' | 'WAITING_EARLY' | 'WAITING_LATE' | 'WAITING_DOCK_UNAVAILABLE' | 'CALLED_TO_DOCK' | 'IN_DOCK' | 'COMPLETED' | null;
  queue_position: number | null;
  actual_dock_id: string | null;
  notes: string | null;
  updated_at: string;
}

export interface DriverException {
  exception_id: string;
  shipment_id: string | null;
  driver_id: string;
  thread_id: string;
  exception_type: 'DELAY' | 'BREAKDOWN' | 'TRAFFIC' | 'WEATHER' | 'EARLY_ARRIVAL' | 'DOCK_UNAVAILABLE' | 'UNKNOWN';
  reported_at: string;
  reported_delay_min: number | null;
  declared_eta_ts: string | null;
  earliest_acceptable_ts: string | null;
  latest_acceptable_ts: string | null;
  severity_code: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  exception_status: 'OPEN' | 'NEEDS_INFORMATION' | 'SLOT_OPTIONS_SHARED' | 'WAITING_CONFIRMATION' | 'RESOLVED' | 'ESCALATED' | 'DUPLICATE' | 'CANCELLED';
  description: string;
  dedupe_key: string | null;
}

export interface ChatThread {
  thread_id: string;
  driver_id: string;
  shipment_id: string | null;
  opened_at: string;
  closed_at: string | null;
  thread_status: 'OPEN' | 'WAITING_FOR_DRIVER' | 'WAITING_FOR_WAREHOUSE' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
  thread_intent: 'REPORT_DELAY' | 'ASK_SLOT_OPTIONS' | 'CHECK_STATUS' | 'EARLY_ARRIVAL' | 'GENERAL_QUESTION' | 'UNKNOWN';
}

export interface ChatMessage {
  chat_message_id: string;
  thread_id: string;
  sender_type: 'DRIVER' | 'AGENT' | 'OPERATIONS' | 'WAREHOUSE' | 'SYSTEM';
  sender_reference: string;
  message_text: string;
  message_ts: string;
  external_message_id: string | null;
  is_duplicate: number;
  parsed_intent: string | null;
  extracted_eta_ts: string | null;
  requires_human_review: number;
}
