import React, { useState, useEffect } from 'react';
import {
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Truck,
  RefreshCw,
  Calendar,
  AlertCircle,
  Wrench,
  ChevronRight,
  ShieldAlert,
  Search,
  Users,
  Phone,
  Mail,
  XCircle,
  Check,
  X,
  ShieldCheck,
  Eye,
  Lock,
  UserCheck,
  UserX,
  UserPlus,
  FileText,
} from 'lucide-react';
import { CoordinatorDecisionModal } from './CoordinatorDecisionModal';
import { Coordinator } from '../types';
import { useAuth } from '../context/AuthContext';

interface Facility {
  facility_id: string;
  facility_name: string;
  city: string;
  state: string;
}

export const CoordinatorDashboard: React.FC = () => {
  const { profile, role } = useAuth();
  const isDriver = role === 'driver';
  const isCoordinator = role === 'coordinator';

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('FAC-JAI-01');
  const [overview, setOverview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'driver-approvals' | 'appointments' | 'queue' | 'exceptions' | 'docks' | 'coordinators'>('driver-approvals');
  const [selectedAppointmentForDecision, setSelectedAppointmentForDecision] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Driver approval & rejection states
  const [approvingDriverId, setApprovingDriverId] = useState<string | null>(null);
  const [rejectingDriverId, setRejectingDriverId] = useState<string | null>(null);
  const [rejectModalDriver, setRejectModalDriver] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [driverActionNotification, setDriverActionNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch facilities
  useEffect(() => {
    fetch('/api/facilities')
      .then(res => res.json())
      .then(data => {
        if (data.facilities && data.facilities.length > 0) {
          setFacilities(data.facilities);
          setSelectedFacilityId(prev => {
            const exists = data.facilities.some((f: Facility) => f.facility_id === prev);
            return exists ? prev : data.facilities[0].facility_id;
          });
        }
      })
      .catch(console.error);
  }, []);

  // Fetch coordinator overview for selected facility
  const fetchOverview = () => {
    if (!selectedFacilityId) return;
    setIsLoading(true);
    fetch(`/api/coordinator/${selectedFacilityId}`)
      .then(res => res.json())
      .then(data => setOverview(data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  const handleApproveDriver = async (driverId: string, driverName: string) => {
    setApprovingDriverId(driverId);
    try {
      const coordinatorId = profile?.id || 'COORD001';
      const res = await fetch(`/api/coordinator/drivers/${driverId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinatorId,
          notes: 'Driver identity and vehicle documentation verified by operations.',
        }),
      });
      const data = await res.json();
      if (res.ok && (data.status === 'approved' || data.status === 'success')) {
        setDriverActionNotification({
          type: 'success',
          message: `Driver ${driverName} (${driverId}) has been APPROVED! Dispatch has initialized an active shipment.`,
        });
        setTimeout(() => setDriverActionNotification(null), 6000);
        fetchOverview();
      } else {
        setDriverActionNotification({
          type: 'error',
          message: data.message || 'Failed to approve driver registration.',
        });
      }
    } catch (err: any) {
      setDriverActionNotification({
        type: 'error',
        message: err.message || 'Network error approving driver.',
      });
    } finally {
      setApprovingDriverId(null);
    }
  };

  const handleApproveAllPending = async () => {
    const pending = overview?.pending_drivers || [];
    if (pending.length === 0) return;
    const coordinatorId = profile?.id || 'COORD001';
    try {
      for (const d of pending) {
        await fetch(`/api/coordinator/drivers/${d.driver_id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coordinatorId,
            notes: 'Batch verified and approved by warehouse operations coordinator.',
          }),
        });
      }
      setDriverActionNotification({
        type: 'success',
        message: `Successfully approved all ${pending.length} pending driver applications into active fleet!`,
      });
      setTimeout(() => setDriverActionNotification(null), 6000);
      fetchOverview();
    } catch (e: any) {
      setDriverActionNotification({
        type: 'error',
        message: e.message || 'Error during batch approval.',
      });
    }
  };

  const handleRejectDriver = async () => {
    if (!rejectModalDriver) return;
    const driverId = rejectModalDriver.driver_id;
    const driverName = rejectModalDriver.driver_name;
    setRejectingDriverId(driverId);
    try {
      const coordinatorId = profile?.id || 'COORD001';
      const res = await fetch(`/api/coordinator/drivers/${driverId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinatorId,
          reason: rejectionReasonInput || 'Vehicle registration documentation could not be authenticated.',
        }),
      });
      const data = await res.json();
      if (res.ok && (data.status === 'rejected' || data.status === 'success')) {
        setDriverActionNotification({
          type: 'success',
          message: `Driver ${driverName} (${driverId}) registration was REJECTED.`,
        });
        setTimeout(() => setDriverActionNotification(null), 6000);
        setRejectModalDriver(null);
        setRejectionReasonInput('');
        fetchOverview();
      } else {
        setDriverActionNotification({
          type: 'error',
          message: data.message || 'Failed to reject driver.',
        });
      }
    } catch (err: any) {
      setDriverActionNotification({
        type: 'error',
        message: err.message || 'Network error rejecting driver.',
      });
    } finally {
      setRejectingDriverId(null);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [selectedFacilityId]);

  // Periodic polling for live updates
  useEffect(() => {
    const timer = setInterval(() => {
      if (selectedFacilityId) {
        fetch(`/api/coordinator/${selectedFacilityId}`)
          .then(res => res.json())
          .then(data => setOverview(data))
          .catch(() => {});
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [selectedFacilityId]);

  const pendingAppointments = overview?.appointments?.filter(
    (a: any) => a.appointment_status === 'PENDING_CONFIRMATION'
  ) || [];

  const activeCoordinators: Coordinator[] = overview?.coordinators || [];

  if (isDriver) {
    return (
      <div className="max-w-3xl mx-auto p-6 my-12 text-center bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Access Restricted to Coordinators</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          You are currently logged in as a <strong>Driver</strong> ({profile?.fullName}). The Facility Coordinator Dashboard is strictly isolated for warehouse operations staff.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
      {/* Coordinator Authority Banner */}
      <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-200 animate-fade-in shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-emerald-100 flex items-center gap-1.5">
              <span>Operations Coordinator Console</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                {profile?.fullName || 'Coordinator'} ({profile?.id || 'COORD'})
              </span>
            </div>
            <p className="text-[11px] text-emerald-300/80">
              You have full authority to review slot change requests, issue warehouse sign-off tokens, assign docks, and manage yard exceptions.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-900/40 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex-shrink-0">
          <CheckCircle2 className="w-3 h-3" />
          <span>Full Decision Authority</span>
        </div>
      </div>

      {/* Top Header & Facility Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-100 flex items-center gap-2">
              {overview?.facility?.facility_name || 'Loading Facility...'}
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono font-normal">
                {overview?.facility?.facility_id}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {overview?.facility?.city}, {overview?.facility?.state} • Operating Hours: {overview?.facility?.open_time} - {overview?.facility?.close_time}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">Facility:</label>
            <select
              id="facility-select"
              value={selectedFacilityId}
              onChange={e => setSelectedFacilityId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
            >
              {facilities.map(f => (
                <option key={f.facility_id} value={f.facility_id}>
                  {f.facility_name} ({f.city})
                </option>
              ))}
            </select>
          </div>

          <button
            id="btn-refresh-coordinator"
            onClick={fetchOverview}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh overview"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Driver Action Notification Banner */}
      {driverActionNotification && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-lg transition-all animate-fade-in ${
            driverActionNotification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {driverActionNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            )}
            <span className="font-medium">{driverActionNotification.message}</span>
          </div>
          <button
            onClick={() => setDriverActionNotification(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Pending Driver Registrations KPI */}
        <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-4 shadow-lg flex items-center justify-between bg-gradient-to-br from-slate-900 to-amber-950/30">
          <div>
            <span className="text-xs text-amber-400/90 font-medium">Pending Drivers</span>
            <div className="text-2xl font-bold text-amber-300 mt-1">
              {overview?.pending_drivers?.length || 0}
            </div>
            <span className="text-[11px] text-slate-400">Awaiting Sign-off</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <UserPlus className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Confirmations KPI */}
        <div className="bg-slate-900/90 border border-blue-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between bg-gradient-to-br from-slate-900 to-blue-950/20">
          <div>
            <span className="text-xs text-blue-400/90 font-medium">Pending Docks</span>
            <div className="text-2xl font-bold text-blue-300 mt-1">
              {pendingAppointments.length}
            </div>
            <span className="text-[11px] text-slate-400">Slot Requests</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Confirmed Appointments KPI */}
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between bg-gradient-to-br from-slate-900 to-emerald-950/20">
          <div>
            <span className="text-xs text-emerald-400/90 font-medium">Active Bookings</span>
            <div className="text-2xl font-bold text-emerald-300 mt-1">
              {overview?.appointments?.filter((a: any) => a.appointment_status === 'CONFIRMED')?.length || 0}
            </div>
            <span className="text-[11px] text-slate-400">Approved for today</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Assigned Coordinators KPI */}
        <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between bg-gradient-to-br from-slate-900 to-cyan-950/20">
          <div>
            <span className="text-xs text-cyan-400/90 font-medium">Coordinators</span>
            <div className="text-2xl font-bold text-cyan-300 mt-1">
              {activeCoordinators.length}
            </div>
            <span className="text-[11px] text-slate-400">
              {activeCoordinators.filter(c => c.status === 'ON_DUTY').length} On Duty Now
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active Exceptions KPI */}
        <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between bg-gradient-to-br from-slate-900 to-rose-950/20">
          <div>
            <span className="text-xs text-rose-400/90 font-medium">Open Exceptions</span>
            <div className="text-2xl font-bold text-rose-300 mt-1">
              {overview?.exceptions?.length || 0}
            </div>
            <span className="text-[11px] text-slate-400">Delays / Breakdowns</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Section Navigation Tabs & Search */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              id="subtab-driver-approvals"
              onClick={() => setActiveTab('driver-approvals')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'driver-approvals'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 border border-amber-400/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>
                Driver Approvals ({overview?.pending_drivers?.length || 0})
              </span>
              {(overview?.pending_drivers?.length || 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold animate-pulse">
                  Review
                </span>
              )}
            </button>

            <button
              id="subtab-appointments"
              onClick={() => setActiveTab('appointments')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'appointments'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Appointments & Requests ({overview?.appointments?.length || 0})
                {pendingAppointments.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                    {pendingAppointments.length} pending
                  </span>
                )}
              </span>
            </button>

            <button
              id="subtab-coordinators"
              onClick={() => setActiveTab('coordinators')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'coordinators'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Coordinators ({activeCoordinators.length})</span>
            </button>

            <button
              id="subtab-queue"
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'queue'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 border border-cyan-400/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Gate & Yard Queue ({overview?.queue?.length || 0})</span>
            </button>

            <button
              id="subtab-exceptions"
              onClick={() => setActiveTab('exceptions')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'exceptions'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 border border-rose-400/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Exceptions ({overview?.exceptions?.length || 0})</span>
            </button>

            <button
              id="subtab-docks"
              onClick={() => setActiveTab('docks')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'docks'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Dock Events ({overview?.dockEvents?.length || 0})</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by Order, Driver, Coordinator..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-750 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-56"
            />
          </div>
        </div>

        {/* Tab 0: Driver Approvals & Registration Verification Queue */}
        {activeTab === 'driver-approvals' && (
          <div className="p-4 space-y-5">
            {/* Header info card */}
            <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Driver Directory & Compliance Security Gateway</h3>
                    <p className="text-xs text-slate-400">
                      Total Registered Drivers in Database: <strong className="text-cyan-400 font-mono">{((overview?.approved_drivers?.length || 0) + (overview?.pending_drivers?.length || 0))} Drivers</strong> ({overview?.approved_drivers?.length || 0} Approved Fleet + {overview?.pending_drivers?.length || 0} Pending Applications)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/40">
                  {overview?.pending_drivers?.length || 0} Pending Approvals
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-2">
                <strong>Operational Policy:</strong> Newly registered drivers are quarantined in <strong>PENDING</strong> status. The AI assistant welcomes the driver and notifies them that their registration is being processed by the facility coordinator. Once you click <strong>Approve</strong>, their account is activated and an operational shipment is dispatched.
              </p>
            </div>

            {/* Pending Drivers Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pending Driver Applications ({overview?.pending_drivers?.length || 0})</span>
                </h4>
                {(overview?.pending_drivers?.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={handleApproveAllPending}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve All Pending ({overview?.pending_drivers?.length})</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Driver Profile</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Assigned Vehicle Plate</th>
                      <th className="py-3 px-4">Registration Date</th>
                      <th className="py-3 px-4">Gate & Chatbot Status</th>
                      <th className="py-3 px-4 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {overview?.pending_drivers
                      ?.filter((d: any) =>
                        !searchTerm ||
                        d.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        d.driver_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        d.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        d.vehicle_registration?.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      ?.map((d: any) => (
                        <tr key={d.driver_id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold text-xs">
                                {d.driver_name?.substring(0, 2).toUpperCase() || 'DR'}
                              </div>
                              <div>
                                <span className="font-bold text-slate-100 block">{d.driver_name}</span>
                                <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/50">
                                  {d.driver_id}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-slate-300">
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span className="font-mono text-[11px]">{d.email}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{d.phone || '+91 98765 00000'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-cyan-400" />
                              <span className="font-mono font-bold text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40 text-xs">
                                {d.vehicle_registration || 'Pending Submission'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                            {d.registered_at ? new Date(d.registered_at).toLocaleDateString() : 'Today'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                <Clock className="w-2.5 h-2.5 animate-pulse" />
                                PENDING REVIEW
                              </span>
                              <div className="text-[10px] text-slate-500">
                                Chatbot active with coordinator notice
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                id={`btn-approve-driver-${d.driver_id}`}
                                disabled={approvingDriverId === d.driver_id}
                                onClick={() => handleApproveDriver(d.driver_id, d.driver_name)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
                              >
                                {approvingDriverId === d.driver_id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                id={`btn-reject-driver-${d.driver_id}`}
                                onClick={() => {
                                  setRejectModalDriver(d);
                                  setRejectionReasonInput('Vehicle credentials could not be verified.');
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 border border-slate-700 transition-colors text-xs flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {(!overview?.pending_drivers || overview.pending_drivers.length === 0) && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-400">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
                          <p className="font-semibold text-slate-200">No Pending Driver Registrations</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            All registered drivers have been verified by facility operations.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approved Drivers Reference List */}
            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Approved Fleet Drivers ({overview?.approved_drivers?.length || 0})</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {overview?.approved_drivers
                  ?.filter((d: any) =>
                    !searchTerm ||
                    d.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    d.driver_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    d.vehicle_registration?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  ?.map((d: any) => (
                    <div
                      key={d.driver_id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5 truncate">
                          <span>{d.driver_name}</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {d.driver_id}
                          </span>
                        </div>
                        <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
                          {d.vehicle_registration || 'Fleet Vehicle'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex-shrink-0">
                        APPROVED
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Appointments & Schedule (with Coordinator Review Actions) */}
        {activeTab === 'appointments' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order / ID</th>
                  <th className="py-3 px-4">Driver & Vehicle</th>
                  <th className="py-3 px-4">Dock & Slot</th>
                  <th className="py-3 px-4">Product & Priority</th>
                  <th className="py-3 px-4">Status & Sign-Off</th>
                  <th className="py-3 px-4 text-right">Coordinator Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {overview?.appointments
                  ?.filter((appt: any) =>
                    !searchTerm ||
                    appt.order_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    appt.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    appt.approved_by_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    appt.vehicle_reg?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  ?.map((appt: any) => (
                    <tr key={appt.appointment_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-medium text-slate-100 block">
                          {appt.order_reference}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {appt.appointment_id}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-200 font-medium block">{appt.driver_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {appt.vehicle_reg || 'N/A'} {appt.carrier_name ? `• ${appt.carrier_name}` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
                          <span>Dock {appt.dock_code}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {appt.dock_type}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {appt.slot_start_ts?.split('T')[1]?.substring(0, 5)}–
                          {appt.slot_end_ts?.split('T')[1]?.substring(0, 5)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-300 block">{appt.product_category}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-semibold inline-block mt-0.5 ${
                            appt.priority_code === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : appt.priority_code === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {appt.priority_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {appt.appointment_status === 'CONFIRMED' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              CONFIRMED
                            </span>
                            {appt.warehouse_confirmation_ref && (
                              <span className="block text-[10px] font-mono text-emerald-300/90">
                                Ref: {appt.warehouse_confirmation_ref}
                              </span>
                            )}
                            {appt.approved_by_name && (
                              <span className="block text-[10px] text-slate-400">
                                Approved by: <strong className="text-slate-300">{appt.approved_by_name}</strong>
                              </span>
                            )}
                          </div>
                        ) : appt.appointment_status === 'REJECTED' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold">
                              <XCircle className="w-3.5 h-3.5" />
                              REJECTED
                            </span>
                            {appt.rejection_reason && (
                              <span className="block text-[10px] text-rose-300/90 max-w-xs">
                                "{appt.rejection_reason}"
                              </span>
                            )}
                            {appt.rejected_by_name && (
                              <span className="block text-[10px] text-slate-400">
                                By: {appt.rejected_by_name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-semibold">
                              <Clock className="w-3.5 h-3.5" />
                              PENDING APPROVAL
                            </span>
                            <span className="block text-[10px] text-amber-300/80">
                              Driver requested slot change
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {appt.appointment_status === 'PENDING_CONFIRMATION' ? (
                          isCoordinator ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                id={`btn-decision-${appt.appointment_id}`}
                                onClick={() => setSelectedAppointmentForDecision(appt)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Review & Decide</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end">
                              <span className="text-[11px] font-medium text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg flex items-center gap-1.5">
                                <Clock className="w-3 h-3 animate-pulse" />
                                <span>Awaiting Coordinator Sign-off</span>
                              </span>
                            </div>
                          )
                        ) : appt.appointment_status === 'CONFIRMED' ? (
                          <span className="text-[11px] font-mono text-emerald-400 flex items-center justify-end gap-1">
                            <Check className="w-3 h-3" /> Signed Off
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-rose-400 flex items-center justify-end gap-1">
                            <X className="w-3 h-3" /> Slot Released
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                {(!overview?.appointments || overview.appointments.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      No active appointments for this facility today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Coordinators Directory */}
        {activeTab === 'coordinators' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Authorized Operations Coordinators
                </h3>
                <p className="text-xs text-slate-400">
                  Coordinators assigned to manage, approve, or reject dock slot bookings at {overview?.facility?.facility_name}.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono">
                {activeCoordinators.length} Assigned Staff
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCoordinators.map(coord => (
                <div
                  key={coord.coordinator_id}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{coord.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            coord.status === 'ON_DUTY'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {coord.status === 'ON_DUTY' ? '● On Duty' : '● Active'}
                        </span>
                      </div>
                      <p className="text-xs text-cyan-400 font-medium mt-0.5">{coord.role_title}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      ID: {coord.coordinator_id}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80 font-mono">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <a href={`tel:${coord.phone}`} className="hover:text-cyan-400 transition-colors">
                        {coord.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-300 truncate" title={coord.email}>
                        {coord.email}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Shift Hours: <strong className="text-slate-200">{coord.shift_hours}</strong></span>
                      <span>Facility: <strong className="text-slate-200">{coord.facility_id}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Gate & Yard Queue */}
        {activeTab === 'queue' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Queue Pos</th>
                  <th className="py-3 px-4">Order / ID</th>
                  <th className="py-3 px-4">Driver & Vehicle</th>
                  <th className="py-3 px-4">Arrival State</th>
                  <th className="py-3 px-4">Queue State</th>
                  <th className="py-3 px-4">Gate In Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {overview?.queue
                  ?.filter((q: any) =>
                    !searchTerm ||
                    q.order_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    q.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  ?.map((item: any) => (
                    <tr key={item.checkin_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold flex items-center justify-center text-xs">
                          {item.queue_position || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-medium text-slate-100 block">
                          {item.order_reference}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.required_dock_type} Dock Required
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-200 font-medium block">{item.driver_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{item.registration_number}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            item.arrival_state === 'EARLY'
                              ? 'bg-blue-950 border border-blue-800 text-blue-300'
                              : item.arrival_state === 'ON_TIME'
                              ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                              : 'bg-amber-950 border border-amber-800 text-amber-300'
                          }`}
                        >
                          {item.arrival_state}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs text-slate-300">{item.queue_state}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">
                        {item.gate_in_ts?.split('T')[1]?.substring(0, 5) || 'Pending'}
                      </td>
                    </tr>
                  ))}
                {(!overview?.queue || overview.queue.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      No vehicles currently waiting in yard queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Driver Exceptions */}
        {activeTab === 'exceptions' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Exception ID</th>
                  <th className="py-3 px-4">Type & Severity</th>
                  <th className="py-3 px-4">Driver & Order</th>
                  <th className="py-3 px-4">Reported Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reported At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {overview?.exceptions
                  ?.filter((exc: any) =>
                    !searchTerm ||
                    exc.order_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    exc.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  ?.map((exc: any) => (
                    <tr key={exc.exception_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">{exc.exception_id}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-semibold text-slate-200">{exc.exception_type}</span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-semibold inline-block mt-0.5 ${
                            exc.severity_code === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {exc.severity_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-200 font-medium block">{exc.driver_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {exc.order_reference || 'Unassigned / Needs Ref'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 max-w-xs">{exc.description}</td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono">
                          {exc.exception_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">
                        {exc.reported_at?.split('T')[1]?.substring(0, 5) || '-'}
                      </td>
                    </tr>
                  ))}
                {(!overview?.exceptions || overview.exceptions.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      No open exceptions reported.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: Dock Events & Maintenance */}
        {activeTab === 'docks' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview?.dockEvents?.map((event: any) => (
                <div
                  key={event.dock_event_id}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-400" />
                      <span className="font-semibold text-sm text-slate-200">
                        Dock {event.dock_code} Event
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                      {event.event_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{event.reason}</p>
                  <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-800/80">
                    <span>
                      Start: {event.event_start_ts?.split('T')[1]?.substring(0, 5) || event.event_start_ts}
                    </span>
                    <span>
                      End: {event.event_end_ts ? event.event_end_ts.split('T')[1]?.substring(0, 5) : 'Ongoing'}
                    </span>
                  </div>
                </div>
              ))}
              {(!overview?.dockEvents || overview.dockEvents.length === 0) && (
                <div className="col-span-2 text-center py-8 text-slate-500">
                  All facility docks are currently active with no maintenance restrictions.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Coordinator Decision Modal (Approve & Reject with Real-time Driver Chat Notification) */}
      <CoordinatorDecisionModal
        isOpen={!!selectedAppointmentForDecision}
        appointment={selectedAppointmentForDecision}
        coordinators={activeCoordinators}
        activeCoordinatorId={activeCoordinators[0]?.coordinator_id || 'COORD001'}
        onClose={() => setSelectedAppointmentForDecision(null)}
        onSuccess={() => {
          fetchOverview();
        }}
      />

      {/* Driver Registration Rejection Reason Modal */}
      {rejectModalDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-100">Reject Driver Registration</h3>
              </div>
              <button
                onClick={() => setRejectModalDriver(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Driver:</span>
                <span className="font-bold text-slate-200">{rejectModalDriver.driver_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Driver ID:</span>
                <span className="font-mono text-cyan-300">{rejectModalDriver.driver_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vehicle:</span>
                <span className="font-mono text-slate-300">{rejectModalDriver.vehicle_registration || 'None'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Rejection Reason (will be logged in security audit):
              </label>
              <textarea
                value={rejectionReasonInput}
                onChange={e => setRejectionReasonInput(e.target.value)}
                rows={3}
                placeholder="Specify reason (e.g. Invalid commercial vehicle registration or lack of carrier insurance)..."
                className="w-full bg-slate-950 border border-slate-750 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRejectModalDriver(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-driver-rejection"
                disabled={rejectingDriverId === rejectModalDriver.driver_id}
                onClick={handleRejectDriver}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {rejectingDriverId === rejectModalDriver.driver_id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
