# SetuHaul Database Contract

## Authoritative Data Model
All tables, views, and indexes are defined in `data/setuhaul_schema_and_seed.sql`. 
The application **never creates or modifies schema**—only inserts/updates data in existing tables.

## Core Relationship Chains

### TMS (Transport Management) Chain
```
driver (DRV001)
  ↓
driver.carrier_id → carriers (CAR001)
  ↓
shipments (SHP1006) links to:
  - shipments.driver_id → drivers.driver_id
  - shipments.carrier_id → carriers.carrier_id
  - shipments.vehicle_id → vehicles.vehicle_id
  - vehicles.carrier_id → carriers.carrier_id
  - vehicles.vehicle_type_code → vehicle_types.vehicle_type_code
```

### WMS (Warehouse Management) & Dock Scheduling Chain
```
shipments.destination_facility_id → facilities (FAC-JAI-01)
  ↓
facilities.facility_id → docks (DOCK-JAI-D1, DOCK-JAI-D2, ...)
  ↓
docks.dock_id → appointment_slots (SLOT-JAI-001, SLOT-JAI-002, ...)
  ↓
appointment_slots.slot_id → appointments (APT1001, APT1013A, ...)
  ↓
appointments.appointment_id → (PENDING_CONFIRMATION | CONFIRMED | IN_PROGRESS | CANCELLED | COMPLETED | NO_SHOW)
```

### Operational State Chain
```
shipments.shipment_id → facility_checkins (gate_in_ts, arrival_state, queue_position)
                     ↓
                     dock_status_events (temporary dock issues, capacity changes)
                     ↓
                     facility_rules (dock_type, reefer, heavy-load, no-show, last-new-start-time constraints)
```

### Conversation & Exception Chain
```
drivers.driver_id → chat_threads (THR001, THR002, ...)
  ↓
chat_threads.shipment_id → shipments (SHP1006, SHP1013, ...) [optional, may be NULL]
  ↓
chat_threads.thread_id → chat_messages (MSG001, MSG002, ...)
                      ↓
                      driver_exceptions (reported_at, exception_status, exception_reason)
                      ↓
                      eta_updates (declared_eta_ts, source_type, confidence_code)
```

## Key Tables

### shipments
- **shipment_id**: Unique order identifier (SHP1006)
- **order_reference**: Human-readable order number (ORD-260804-006)
- **driver_id, carrier_id, vehicle_id**: TMS links
- **destination_facility_id**: Warehouse/dock facility target
- **required_dock_type**: STANDARD | REEFER | HEAVY
- **temperature_control_required**: Boolean (reefer flag)
- **load_weight_kg**: Vehicle weight constraint
- **priority_code**: Operational priority
- **original_eta_ts, latest_eta_ts**: Original vs. declared ETA
- **expected_unload_min**: Duration needed at dock
- **current_status**: ASSIGNED, IN_TRANSIT, AT_GATE, WAITING, IN_DOCK, COMPLETED, CANCELLED

### appointment_slots
- **slot_id**: Unique time window (SLOT-JAI-001)
- **dock_id, facility_id**: Location and facility reference
- **slot_start_ts, slot_end_ts**: ISO 8601 time window (30 min – 2+ hours)
- **slot_status**: OPEN | BLOCKED (dock breakdown) | CLOSED (facility closed)

### appointments
- **appointment_id**: Unique booking record (APT1006, APT1013A)
- **shipment_id, slot_id**: Which shipment booked which slot
- **appointment_status**: PENDING_CONFIRMATION | CONFIRMED | IN_PROGRESS | CANCELLED | COMPLETED | NO_SHOW
- **booking_source**: PLANNER (pre-loaded) | DRIVER_CHAT (driver-initiated)
- **is_current**: Boolean; only one active current appointment per shipment
- **booked_at, confirmed_at, cancelled_at**: Audit timestamps
- **warehouse_confirmation_ref**: External WMS booking reference (set only when CONFIRMED)

### chat_threads
- **thread_id**: Conversation identifier (THR001)
- **driver_id**: Trusted from session
- **shipment_id**: Optional; NULL if driver has ambiguous assignment
- **thread_status**: OPEN | WAITING_FOR_DRIVER | WAITING_FOR_WAREHOUSE | ESCALATED | CLOSED
- **thread_reason**: REPORT_DELAY | EARLY_ARRIVAL | CHECK_STATUS | ASK_SLOT_OPTIONS

### chat_messages
- **chat_message_id**: Unique message ID (MSG001)
- **thread_id**: Conversation this message belongs to
- **role**: DRIVER | AGENT
- **sender_id**: Driver ID or 'agent'
- **message_text**: Human-readable message
- **message_ts**: When sent
- **is_duplicate**: Boolean; retry flag to avoid duplicate exceptions

### driver_exceptions
- **exception_id**: Unique exception record
- **driver_id, thread_id**: Conversation context
- **shipment_id**: Optional; which shipment is affected
- **exception_status**: PENDING_RESOLUTION | RESOLVED | ESCALATED
- **exception_reason**: Structured category (DELAY, REEFER_UNAVAILABLE, NO_FEASIBLE_SLOT, etc.)
- **reported_at**: When driver reported the issue

### eta_updates
- **eta_update_id**: Unique ETA revision
- **shipment_id**: Which shipment's ETA changed
- **declared_eta_ts**: Driver's new ETA (ISO 8601)
- **source_type**: DRIVER_DECLARED | PLANNER_ADJUSTED | GPS_INFERRED
- **confidence_code**: HIGH | MEDIUM | LOW
- **delay_reason_code**: TRAFFIC, MECHANICAL, WEATHER, etc.

### facility_checkins
- **checkin_id**: Gate/yard event record
- **facility_id, shipment_id**: Which shipment checked in where
- **gate_in_ts**: Actual gate arrival
- **arrival_state**: EARLY | ON_TIME | LATE
- **queue_state**: WAITING_EARLY | WAITING_LATE | WAITING_DOCK_UNAVAILABLE | CALLED_TO_DOCK
- **queue_position**: Current position in facility queue

## Four Core Views

### v_latest_eta
- **Purpose**: Authoritative effective ETA for every shipment
- **Rows**: One per shipment
- **Columns**: 
  - `effective_eta_ts`: COALESCE(driver-declared ETA, planner ETA, original ETA)
  - `eta_source`: DRIVER_DECLARED | ORIGINAL_PLAN
  - `eta_confidence`: HIGH | MEDIUM | LOW
  - `delay_reason_code`: Why the ETA changed
- **Used by**: Feasibility checks, slot matching, queue visualization

### v_slot_availability
- **Purpose**: Real-time slot state for a facility/dock/time
- **Rows**: All appointment_slots with availability status
- **Columns**:
  - `availability_status`: AVAILABLE | OCCUPIED | BLOCKED | CLOSED
  - `dock_type, supports_refrigerated, max_vehicle_weight_kg`: Dock constraints
  - `appointment_id, appointment_status`: If OCCUPIED, which booking
- **Used by**: Slot search, availability display, booking validation

### v_inbound_operational_state
- **Purpose**: Complete inbound shipment context (operational snapshot)
- **Rows**: One per non-terminal shipment (ASSIGNED, IN_TRANSIT, AT_GATE, WAITING, IN_DOCK)
- **Columns**: Shipment + vehicle + facility + facility_checkin + current appointment + latest ETA
- **Used by**: Agent operational queries, facility queue reasoning

### v_current_facility_queue
- **Purpose**: Real-time queue at a facility (trucks waiting at gate or called to dock)
- **Rows**: shipments currently at a facility with queue state = WAITING_* or CALLED_TO_DOCK
- **Columns**: facility_id, priority, queue_position, ETA, required_dock_type, expected_unload_min
- **Used by**: Coordinator dashboard, queue visualization

## Concurrency Model: Partial Unique Indexes

### ux_active_appointment_per_slot
```sql
CREATE UNIQUE INDEX ux_active_appointment_per_slot
ON appointments(slot_id)
WHERE appointment_status IN ('PENDING_CONFIRMATION','CONFIRMED','IN_PROGRESS');
```
- **Purpose**: Ensure only ONE active booking per slot
- **Enforced states**: PENDING_CONFIRMATION | CONFIRMED | IN_PROGRESS
- **How it works**: SQLite raises `UNIQUE constraint failed` if a second active appointment tries to use the same slot
- **Conflict resolution**: When double-book attempt is caught, app treats `sqlite3.IntegrityError` as expected conflict; driver gets fresh slot options

### ux_current_active_appointment_per_shipment
```sql
CREATE UNIQUE INDEX ux_current_active_appointment_per_shipment
ON appointments(shipment_id)
WHERE is_current = 1
  AND appointment_status IN ('PENDING_CONFIRMATION','CONFIRMED','IN_PROGRESS');
```
- **Purpose**: Ensure only ONE active current booking per shipment
- **Why two fields**: `is_current` + `appointment_status`; allows history tracking (old CANCELLED appointments don't violate the index)
- **Conflict resolution**: When replacing a booking, old appointment is marked `is_current = 0` and `appointment_status = CANCELLED` in same transaction; new appointment is created with `is_current = 1`

## Booking State Model

### A Displayed Slot Is Not Held
- Query `v_slot_availability` → `availability_status = AVAILABLE`
- Show slot to driver
- Slot is **not reserved**; another driver/system could book it

### Driver Selects a Slot → PENDING_CONFIRMATION
- Driver confirms their choice (button click)
- **One deterministic transaction**:
  1. Re-read slot state to confirm still AVAILABLE
  2. Re-read shipment state
  3. Check feasibility (reefer support, weight, dock type, ETA confidence, facility rules)
  4. INSERT appointment with `appointment_status = PENDING_CONFIRMATION`, `booking_source = DRIVER_CHAT`, `is_current = 1`, `booked_at = NOW()`
  5. **Database unique index enforces**: only one PENDING_CONFIRMATION per slot
- If conflict (UNIQUE constraint failed): another driver won it → backend returns fresh slot options
- **Result**: Driver sees "Your booking is pending warehouse confirmation"

### PENDING_CONFIRMATION Consumes Capacity
- Slot is now OCCUPIED (shown as unavailable to other drivers)
- Appointment counts against active shipments at facility
- v_slot_availability shows `appointment_status = PENDING_CONFIRMATION`

### Only Explicit Warehouse Confirmation → CONFIRMED
- **External warehouse system** calls backend to confirm or reject
- **Confirmed update**: SET `appointment_status = CONFIRMED`, `confirmed_at = NOW()`, `warehouse_confirmation_ref = 'WH-JAI-9001'`
- Until this update, slot/shipment is still "pending" in the driver's view
- **Result**: Driver sees "Booking confirmed for warehouse slot 10:00–11:00"

### CONFIRMED Also Consumes Capacity (Still Held)
- Slot remains unavailable to other drivers
- Appointment counts in facility capacity
- Difference: confirmed has external WMS reference (`warehouse_confirmation_ref`)

### IN_PROGRESS (At Dock)
- Driver arrived at dock, unload started
- `appointment_status = IN_PROGRESS`
- Still counts against capacity; slot and shipment locked

### CANCELLED (Old Appointment)
- When replacing: old appointment marked `appointment_status = CANCELLED`, `is_current = 0`, `cancelled_at = NOW()`, `cancellation_reason = 'Driver rebooked'`
- New appointment created with `replaced_appointment_id = old_appointment_id`
- Cancelled slots don't hold capacity (partial index `WHERE appointment_status IN ('PENDING_CONFIRMATION','CONFIRMED','IN_PROGRESS')` excludes CANCELLED)

### COMPLETED / NO_SHOW (Terminal)
- Not capacity consumers (outside the partial unique indexes)
- Permanent history record

---

## Test Scenarios

### SHP1006 (Multiple ETA Updates)
- **Scenario**: Driver DRV006 on SHP1006 (ORD-260804-006) to FAC-JAI-01
- **Original ETA**: 10:40 AM
- **Latest state**: APT1006 = CONFIRMED at SLOT-JAI-045, warehouse_confirmation_ref = WH-JAI-9006
- **Test**: Query `v_latest_eta` WHERE shipment_id = 'SHP1006'
  - Should show effective_eta_ts from most recent eta_update or original_eta_ts

### SHP1015 (No Feasible Reefer Slot)
- **Scenario**: DRV015 on SHP1015 (ORD-260804-015), requires REEFER dock, temperature_control_required = 1
- **Latest ETA**: 18:30 (6:30 PM)
- **Reefer dock (DOCK-JAI-D5)**: MAINTENANCE 18:00–22:00 (DEVT002)
- **Blocked slots**: SLOT-JAI-067, 068, 069, 070 (BLOCKED reason: "Refrigeration power maintenance")
- **Test**: Query `v_slot_availability` WHERE dock_type = 'REEFER' AND facility_id = 'FAC-JAI-01'
  - After 18:00: all REEFER slots are BLOCKED or past needed ETA
  - Feasibility check returns FALSE → escalate to operations

### DRV004 (Ambiguous Assignment)
- **Scenario**: Driver DRV004 has TWO active shipments
  - SHP1004 (ORD-260804-004), current_status = IN_DOCK, APT1004 = CONFIRMED, SLOT-JAI-016 (09:00–10:00)
  - SHP1020 (ORD-260804-020), current_status = ASSIGNED (later pickup)
- **Chat message**: "I will be late by 45 minutes" (MSG016, msg_ts = 09:31)
- **Agent response**: (MSG017) "You have two shipments assigned today. Are you referring to ORD-260804-004 or the later ORD-260804-020?"
- **Test**: Query shipments WHERE driver_id = 'DRV004' AND current_status IN ('ASSIGNED','IN_TRANSIT','AT_GATE','WAITING','IN_DOCK')
  - Should return 2 rows
  - Agent asks by order_reference, NOT shipment_id

### Partial Index Concurrency Test
- **Scenario**: Two concurrent drivers try to book SLOT-JAI-045 (same slot)
  - Driver 1 INSERT APT1013A for SHP1013 → success (ux_active_appointment_per_slot allows it)
  - Driver 2 INSERT APT1014A for SHP1014 on same slot → UNIQUE constraint failed → conflict
- **Test**: Verify index definition with:
  ```sql
  SELECT sql FROM sqlite_master WHERE name = 'ux_active_appointment_per_slot';
  ```
  Should show: `WHERE appointment_status IN ('PENDING_CONFIRMATION','CONFIRMED','IN_PROGRESS')`

---

## Why PENDING_CONFIRMATION vs. CONFIRMED

| Aspect | PENDING_CONFIRMATION | CONFIRMED |
|--------|----------------------|-----------|
| **Who created it** | Driver (via chat agent) | Warehouse (external WMS system) |
| **Slot available?** | No; occupied, unavailable to others | No; occupied, unavailable to others |
| **Counts in capacity?** | Yes | Yes |
| **warehouse_confirmation_ref** | NULL (no external WMS ID yet) | Set (WH-JAI-9001, etc.) |
| **Driver sees** | "Your booking is pending warehouse confirmation" | "Your booking confirmed for slot 10:00–11:00, ref: WH-JAI-9001" |
| **Can be rejected?** | Yes; warehouse can reject & create new options | Unlikely; warehouse already accepted it |
| **Can be rebooked?** | Yes; driver can request new options | No; already committed |

**Key rule**: Never treat an LLM's message or a chat status as a confirmed booking. Only the database appointment_status = CONFIRMED + warehouse_confirmation_ref guarantee the booking is accepted by the warehouse.
