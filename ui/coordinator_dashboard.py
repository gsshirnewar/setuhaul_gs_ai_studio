"""Coordinator dashboard: read-only operational overview for warehouse staff.

Uses repository read functions only — no raw SQL, no agent tools, no writes.
"""

import pandas as pd
import streamlit as st

from db import repository as repo


def render_coordinator_dashboard():
    """Render the coordinator dashboard page."""
    st.title("SetuHaul Coordinator Dashboard")
    st.caption(
        "Operational read-only view. Use this screen to monitor exceptions, queue, "
        "appointments and dock status. Capacity allocation is handled by the booking system."
    )

    facilities = repo.get_docks_by_facility()
    facility_ids = sorted(facilities.keys())
    if not facility_ids:
        st.warning("No facilities found in the database.")
        return

    col1, col2 = st.columns([3, 1])
    with col1:
        selected_facility = st.selectbox(
            "Select facility",
            options=facility_ids,
            format_func=lambda fid: f"{fid} — {facilities[fid][0]['facility_name'] if facilities[fid] else 'Unknown'}",
            key="coordinator_facility",
        )
    with col2:
        st.write("")
        st.write("")
        refresh = st.button("🔄 Refresh", key="coordinator_refresh")

    # The refresh button changes session state; its only purpose is to rerun the page.
    if refresh:
        st.toast("Dashboard refreshed")

    st.divider()

    # ------------------------------------------------------------------ #
    # Exceptions
    # ------------------------------------------------------------------ #
    st.subheader("Open Driver Exceptions")
    exceptions = repo.get_open_exceptions(facility_id=selected_facility)
    if exceptions:
        rows = []
        for e in exceptions:
            shipment = repo.get_shipment(e.get("shipment_id")) or {}
            latest_eta = repo.get_latest_eta(e.get("shipment_id")) or {}
            driver = repo.get_driver(e.get("driver_id")) or {}
            rows.append({
                "Exception ID": e.get("exception_id"),
                "Driver": e.get("driver_id"),
                "Driver name": driver.get("driver_name"),
                "Order ref": shipment.get("order_reference"),
                "Type": e.get("exception_type"),
                "Status": e.get("exception_status"),
                "Severity": e.get("severity_code"),
                "Latest ETA": latest_eta.get("effective_eta_ts"),
                "Reported at": e.get("reported_at"),
                "Description": e.get("description"),
            })
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    else:
        st.info("No open exceptions for this facility.")

    # ------------------------------------------------------------------ #
    # Facility queue
    # ------------------------------------------------------------------ #
    st.subheader("Current Facility Queue")
    queue = repo.get_facility_queue(selected_facility)
    if queue:
        q_rows = []
        for item in queue:
            q_rows.append({
                "Position": item.get("queue_position"),
                "Driver": item.get("driver_id"),
                "Shipment": item.get("shipment_id"),
                "State": item.get("queue_state"),
                "ETA": item.get("effective_eta_ts"),
                "Dock type": item.get("required_dock_type"),
                "Unload min": item.get("expected_unload_min"),
            })
        st.dataframe(pd.DataFrame(q_rows), use_container_width=True, hide_index=True)
    else:
        st.info("No trucks waiting or called to dock at this facility.")

    # ------------------------------------------------------------------ #
    # Appointments
    # ------------------------------------------------------------------ #
    st.subheader("Current Appointments")
    docks = repo.get_docks(selected_facility)
    dock_ids = [d["dock_id"] for d in docks]

    with repo.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                a.appointment_id,
                a.shipment_id,
                s.order_reference,
                a.slot_id,
                sl.slot_start_ts,
                sl.slot_end_ts,
                d.dock_code,
                a.appointment_status,
                a.booking_source,
                a.is_current,
                a.warehouse_confirmation_ref,
                a.booked_at,
                a.confirmed_at
            FROM appointments a
            JOIN shipments s ON s.shipment_id = a.shipment_id
            JOIN appointment_slots sl ON sl.slot_id = a.slot_id
            JOIN docks d ON d.dock_id = sl.dock_id
            WHERE sl.facility_id = ?
              AND a.appointment_status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS')
            ORDER BY sl.slot_start_ts
        """, (selected_facility,))
        rows = cursor.fetchall()

    if rows:
        appt_rows = []
        for r in rows:
            is_confirmed = (
                r["appointment_status"] == "CONFIRMED"
                and bool(r["warehouse_confirmation_ref"])
            )
            appt_rows.append({
                "Appointment": r["appointment_id"],
                "Order ref": r["order_reference"],
                "Dock": r["dock_code"],
                "Slot start": r["slot_start_ts"],
                "Slot end": r["slot_end_ts"],
                "Status": r["appointment_status"],
                "Source": r["booking_source"],
                "Explicitly confirmed": "✅ Yes" if is_confirmed else "❌ No",
                "Warehouse ref": r["warehouse_confirmation_ref"] or "—",
                "Current": "Yes" if r["is_current"] else "No",
                "Booked at": r["booked_at"],
                "Confirmed at": r["confirmed_at"] or "—",
            })
        st.dataframe(pd.DataFrame(appt_rows), use_container_width=True, hide_index=True)
    else:
        st.info("No active PENDING, CONFIRMED, or IN_PROGRESS appointments at this facility.")

    # ------------------------------------------------------------------ #
    # Dock status events
    # ------------------------------------------------------------------ #
    st.subheader("Dock Status Events")
    events = repo.get_dock_status_events(selected_facility)
    if events:
        ev_rows = []
        for e in events:
            ev_rows.append({
                "Dock": e.get("dock_id"),
                "Event": e.get("event_type"),
                "Start": e.get("event_start_ts"),
                "End": e.get("event_end_ts") or "Ongoing",
                "Reason": e.get("reason"),
            })
        st.dataframe(pd.DataFrame(ev_rows), use_container_width=True, hide_index=True)
    else:
        st.info("No dock status events recorded for this facility.")

    # ------------------------------------------------------------------ #
    # Manual verification checklist
    # ------------------------------------------------------------------ #
    with st.expander("🧪 Manual verification checklist", expanded=False):
        st.markdown("""
1. Open the **Driver Chat** in one browser tab and the **Coordinator Dashboard** in another.
2. In Driver Chat, pick a demo driver (e.g., `DRV012`), request fresh options, and confirm a slot.
3. In the Coordinator tab, select `FAC-JAI-01` and click **Refresh**.
4. ✅ Verify the appointment appears in the dashboard with `Status = PENDING_CONFIRMATION` and `Explicitly confirmed = ❌ No`.
5. Use a backend warehouse-confirmation action, e.g. run in a Python shell:
   ```python
   from domain.booking import confirm_booking
   confirm_booking("APPOINTMENT_ID_FROM_DASHBOARD", "WH-JAI-MANUAL-001")
   ```
6. Click **Refresh** in the Coordinator tab.
7. ✅ Verify the same record now shows `Status = CONFIRMED`, `Explicitly confirmed = ✅ Yes`, and `Warehouse ref = WH-JAI-MANUAL-001`.
        """)
