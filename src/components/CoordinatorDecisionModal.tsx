import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, Clock, Truck, User, Building2, ShieldCheck, FileText, Phone, Mail } from 'lucide-react';
import { Coordinator } from '../types';

interface CoordinatorDecisionModalProps {
  isOpen: boolean;
  appointment: any;
  coordinators: Coordinator[];
  activeCoordinatorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CoordinatorDecisionModal: React.FC<CoordinatorDecisionModalProps> = ({
  isOpen,
  appointment,
  coordinators,
  activeCoordinatorId,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [selectedCoordId, setSelectedCoordId] = useState<string>(activeCoordinatorId || (coordinators[0]?.coordinator_id || 'COORD001'));
  const [refInput, setRefInput] = useState<string>(() => `WH-CONF-${Date.now().toString().slice(-4)}`);
  const [notesInput, setNotesInput] = useState<string>('Proceed to Gate 2 upon arrival. Report to Bay Security.');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !appointment) return null;

  const quickRejectionTemplates = [
    'Scheduled dock undergoing unscheduled maintenance.',
    'Yard capacity reached; please request a slot after 14:00.',
    'Priority temperature-controlled shipment conflict on selected bay.',
    'Driver ETA is outside acceptable gate check-in window.',
  ];

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = refInput.trim() || `WH-CONF-${Date.now().toString().slice(-4)}`;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/appointments/${appointment.appointment_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinatorId: selectedCoordId,
          warehouseConfirmationRef: ref,
          notes: notesInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'confirmed') {
        onSuccess();
        onClose();
      } else {
        setError(data.message || 'Failed to approve appointment');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setError('Please provide a specific reason for rejection to inform the driver.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/appointments/${appointment.appointment_id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinatorId: selectedCoordId,
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'rejected') {
        onSuccess();
        onClose();
      } else {
        setError(data.message || 'Failed to reject appointment');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCoordObj = coordinators.find(c => c.coordinator_id === selectedCoordId) || coordinators[0];

  return (
    <div id="coordinator-decision-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${mode === 'APPROVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {mode === 'APPROVE' ? <ShieldCheck className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm md:text-base">
                {mode === 'APPROVE' ? 'Coordinator Slot Approval' : 'Coordinator Slot Rejection'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Action will update the master database & notify the driver in real-time.
              </p>
            </div>
          </div>
          <button
            id="close-decision-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            id="modal-mode-approve-btn"
            onClick={() => { setMode('APPROVE'); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
              mode === 'APPROVE'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve Slot Request
          </button>
          <button
            type="button"
            id="modal-mode-reject-btn"
            onClick={() => { setMode('REJECT'); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
              mode === 'REJECT'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject Request
          </button>
        </div>

        {/* Request Context Summary */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-slate-400 font-mono">Appt ID: {appointment.appointment_id}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              PENDING APPROVAL
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono">
            <div>
              <span className="text-slate-500 block text-[10px]">DRIVER & CARRIER</span>
              <span className="font-medium text-slate-100">{appointment.driver_name}</span>
              <span className="text-slate-400 block text-[10px]">{appointment.carrier_name || 'Carrier Partner'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">ORDER REF</span>
              <span className="font-semibold text-cyan-400">{appointment.order_reference}</span>
              <span className="text-slate-400 block text-[10px]">{appointment.product_category || 'Standard Freight'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">VEHICLE REG</span>
              <span className="text-slate-200">{appointment.vehicle_reg || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">REQUESTED DOCK & TIME</span>
              <span className="text-emerald-400 font-semibold">
                Dock {appointment.dock_code} ({appointment.slot_start_ts?.split('T')[1]?.substring(0, 5)}–{appointment.slot_end_ts?.split('T')[1]?.substring(0, 5)})
              </span>
            </div>
          </div>
        </div>

        {/* Coordinator Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              Signing Coordinator
            </span>
            {activeCoordObj && (
              <span className="text-[10px] text-emerald-400 font-mono">
                {activeCoordObj.status === 'ON_DUTY' ? '● On Duty' : '● Active'} ({activeCoordObj.shift_hours})
              </span>
            )}
          </label>
          <select
            id="signing-coordinator-select"
            value={selectedCoordId}
            onChange={e => setSelectedCoordId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
          >
            {coordinators.map(c => (
              <option key={c.coordinator_id} value={c.coordinator_id}>
                {c.name} — {c.role_title} ({c.phone})
              </option>
            ))}
          </select>
          {activeCoordObj && (
            <div className="flex items-center gap-3 text-[11px] text-slate-400 px-1 pt-0.5">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-500" /> {activeCoordObj.phone}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-500" /> {activeCoordObj.email}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Approval Form */}
        {mode === 'APPROVE' && (
          <form onSubmit={handleApprove} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Warehouse Sign-Off Confirmation Reference:
              </label>
              <input
                type="text"
                id="modal-confirm-ref-input"
                placeholder="e.g. WH-CONF-JAI-9842"
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">
                This token will be assigned to the driver's gate pass and verified upon arrival.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Gate Instructions / Yard Notes (Optional):
              </label>
              <textarea
                id="modal-gate-notes-input"
                rows={2}
                value={notesInput}
                onChange={e => setNotesInput(e.target.value)}
                placeholder="e.g. Enter via North Gate 2. Present digital QR to weighbridge security."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                id="cancel-approve-modal-btn"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-approve-modal-btn"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Confirming in Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Notify Driver</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Rejection Form */}
        {mode === 'REJECT' && (
          <form onSubmit={handleReject} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Select Rejection Reason Template:
              </label>
              <div className="space-y-1.5 mb-2">
                {quickRejectionTemplates.map((template, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRejectionReason(template)}
                    className={`w-full text-left p-2 rounded-lg text-xs border transition-colors ${
                      rejectionReason === template
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    "{template}"
                  </button>
                ))}
              </div>

              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Custom Rejection Explanation (Sent to Driver):
              </label>
              <textarea
                id="modal-reject-reason-input"
                rows={3}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain clearly to the driver why this slot cannot be accommodated..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                id="cancel-reject-modal-btn"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-reject-modal-btn"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Rejecting & Freeing Slot...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Reject & Notify Driver</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
