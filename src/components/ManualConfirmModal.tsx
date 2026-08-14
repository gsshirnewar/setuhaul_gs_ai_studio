import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ManualConfirmModalProps {
  isOpen: boolean;
  appointment: any;
  onClose: () => void;
  onConfirmSuccess: () => void;
}

export const ManualConfirmModal: React.FC<ManualConfirmModalProps> = ({
  isOpen,
  appointment,
  onClose,
  onConfirmSuccess,
}) => {
  const [refInput, setRefInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = refInput.trim() || `WH-REF-${Date.now().toString().slice(-4)}`;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/appointments/${appointment.appointment_id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseConfirmationRef: ref }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'confirmed') {
        onConfirmSuccess();
        onClose();
      } else {
        setError(data.message || 'Failed to confirm appointment');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Confirm Dock Appointment</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs text-slate-300">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Appointment ID:</span>
              <span className="text-slate-200">{appointment.appointment_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Order:</span>
              <span className="text-slate-200">{appointment.order_reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Driver:</span>
              <span className="text-slate-200">{appointment.driver_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dock & Slot:</span>
              <span className="text-cyan-400">
                Dock {appointment.dock_code} (
                {appointment.slot_start_ts?.split('T')[1]?.substring(0, 5)}–
                {appointment.slot_end_ts?.split('T')[1]?.substring(0, 5)})
              </span>
            </div>
          </div>

          <p className="text-slate-400 text-xs pt-1">
            Confirming this booking marks it as officially accepted by the facility warehouse team and assigns the definitive confirmation token back to the driver.
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Warehouse Confirmation Reference:
            </label>
            <input
              type="text"
              placeholder="e.g. WH-CONF-2026-889"
              value={refInput}
              onChange={e => setRefInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Confirming...' : 'Approve & Confirm'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
