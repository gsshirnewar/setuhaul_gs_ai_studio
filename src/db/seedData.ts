import {
  Coordinator,
  Facility,
  Dock,
  FacilityRule,
  DockStatusEvent,
  Carrier,
  Driver,
  Vehicle,
  VehicleType,
  Shipment,
  AppointmentSlot,
  Appointment,
  ETAUpdate,
  FacilityCheckin,
  DriverException,
  ChatThread,
  ChatMessage,
} from '../types';

export const INITIAL_COORDINATORS: Coordinator[] = [
  {
    coordinator_id: 'COORD001',
    name: 'Vikram Joshi',
    phone: '+91-9829011001',
    email: 'vikram.joshi@setuhaul.com',
    password: 'Password#Coord01',
    facility_id: 'FAC-JAI-01',
    role_title: 'Senior Yard & Dock Operations Lead',
    status: 'ON_DUTY',
    shift_hours: '06:00 - 15:00',
  },
  {
    coordinator_id: 'COORD002',
    name: 'Pooja Sharma',
    phone: '+91-9829022002',
    email: 'pooja.sharma@setuhaul.com',
    password: 'Password#Coord02',
    facility_id: 'FAC-JAI-01',
    role_title: 'Inbound Freight & Scheduling Coordinator',
    status: 'ACTIVE',
    shift_hours: '14:00 - 22:00',
  },
  {
    coordinator_id: 'COORD003',
    name: 'Arun Malhotra',
    phone: '+91-9811033003',
    email: 'arun.malhotra@setuhaul.com',
    password: 'Password#Coord03',
    facility_id: 'FAC-GGN-01',
    role_title: 'Cross-Dock Operations Supervisor',
    status: 'ON_DUTY',
    shift_hours: '07:00 - 16:00',
  },
  {
    coordinator_id: 'COORD004',
    name: 'Meera Deshmukh',
    phone: '+91-9811044004',
    email: 'meera.deshmukh@setuhaul.com',
    password: 'Password#Coord04',
    facility_id: 'FAC-GGN-01',
    role_title: 'Cold Chain & Express Dock Controller',
    status: 'ACTIVE',
    shift_hours: '13:00 - 21:00',
  },
];

export const INITIAL_FACILITIES: Facility[] = [
  { facility_id: 'FAC-JAI-01', facility_name: 'SetuHaul Jaipur Distribution Centre', city: 'Jaipur', state: 'Rajasthan', timezone: 'Asia/Kolkata', open_time: '06:00', close_time: '22:00', checkin_grace_min: 30, default_unload_min: 60, active_flag: 1 },
  { facility_id: 'FAC-GGN-01', facility_name: 'SetuHaul Gurugram Cross-Dock', city: 'Gurugram', state: 'Haryana', timezone: 'Asia/Kolkata', open_time: '07:00', close_time: '21:00', checkin_grace_min: 20, default_unload_min: 45, active_flag: 1 },
];

export const INITIAL_DOCKS: Dock[] = [
  { dock_id: 'DOCK-JAI-D1', facility_id: 'FAC-JAI-01', dock_code: 'D1', dock_type: 'STANDARD', supports_refrigerated: 0, max_vehicle_weight_kg: 20000, dock_status: 'ACTIVE' },
  { dock_id: 'DOCK-JAI-D2', facility_id: 'FAC-JAI-01', dock_code: 'D2', dock_type: 'STANDARD', supports_refrigerated: 0, max_vehicle_weight_kg: 25000, dock_status: 'ACTIVE' },
  { dock_id: 'DOCK-JAI-D3', facility_id: 'FAC-JAI-01', dock_code: 'D3', dock_type: 'STANDARD', supports_refrigerated: 0, max_vehicle_weight_kg: 20000, dock_status: 'ACTIVE' },
  { dock_id: 'DOCK-JAI-D4', facility_id: 'FAC-JAI-01', dock_code: 'D4', dock_type: 'STANDARD', supports_refrigerated: 0, max_vehicle_weight_kg: 25000, dock_status: 'ACTIVE' },
  { dock_id: 'DOCK-JAI-D5', facility_id: 'FAC-JAI-01', dock_code: 'D5', dock_type: 'REEFER', supports_refrigerated: 1, max_vehicle_weight_kg: 22000, dock_status: 'ACTIVE' },
  { dock_id: 'DOCK-JAI-D6', facility_id: 'FAC-JAI-01', dock_code: 'D6', dock_type: 'HEAVY', supports_refrigerated: 0, max_vehicle_weight_kg: 35000, dock_status: 'ACTIVE' },
  { dock_id: 'DOCK-GGN-D1', facility_id: 'FAC-GGN-01', dock_code: 'D1', dock_type: 'STANDARD', supports_refrigerated: 0, max_vehicle_weight_kg: 22000, dock_status: 'ACTIVE' },
  { dock_id: 'DOCK-GGN-D2', facility_id: 'FAC-GGN-01', dock_code: 'D2', dock_type: 'STANDARD', supports_refrigerated: 0, max_vehicle_weight_kg: 22000, dock_status: 'ACTIVE' },
  { dock_id: 'DOCK-GGN-D3', facility_id: 'FAC-GGN-01', dock_code: 'D3', dock_type: 'REEFER', supports_refrigerated: 1, max_vehicle_weight_kg: 20000, dock_status: 'ACTIVE' },
];

export const INITIAL_FACILITY_RULES: FacilityRule[] = [
  { rule_id: 'RULE001', facility_id: 'FAC-JAI-01', rule_type: 'CHECKIN_EARLY_LIMIT_MIN', rule_value: '60', description: 'Trucks may check in up to 60 minutes before the booked slot.', effective_from: '2026-01-01', active_flag: 1 },
  { rule_id: 'RULE002', facility_id: 'FAC-JAI-01', rule_type: 'NO_SHOW_GRACE_MIN', rule_value: '30', description: 'A truck may be marked no-show 30 minutes after the slot starts if it has not checked in.', effective_from: '2026-01-01', active_flag: 1 },
  { rule_id: 'RULE003', facility_id: 'FAC-JAI-01', rule_type: 'REEFER_DOCK_REQUIRED', rule_value: 'TRUE', description: 'Temperature-controlled loads must use dock D5.', effective_from: '2026-01-01', active_flag: 1 },
  { rule_id: 'RULE004', facility_id: 'FAC-JAI-01', rule_type: 'HEAVY_DOCK_REQUIRED_KG', rule_value: '25000', description: 'Loads above 25,000 kg must use the heavy dock.', effective_from: '2026-01-01', active_flag: 1 },
  { rule_id: 'RULE005', facility_id: 'FAC-JAI-01', rule_type: 'LAST_NEW_START_TIME', rule_value: '21:00', description: 'No new unloading operation should start after 21:00 without manual approval.', effective_from: '2026-01-01', active_flag: 1 },
  { rule_id: 'RULE006', facility_id: 'FAC-GGN-01', rule_type: 'NO_SHOW_GRACE_MIN', rule_value: '20', description: 'A truck may be marked no-show 20 minutes after the slot starts.', effective_from: '2026-01-01', active_flag: 1 },
];

export const INITIAL_DOCK_STATUS_EVENTS: DockStatusEvent[] = [
  { dock_event_id: 'DEVT001', dock_id: 'DOCK-JAI-D3', event_type: 'BREAKDOWN', event_start_ts: '2026-08-04T09:15:00+05:30', event_end_ts: '2026-08-04T13:00:00+05:30', reason: 'Hydraulic dock leveller failure', created_at: '2026-08-04T09:16:00+05:30' },
  { dock_event_id: 'DEVT002', dock_id: 'DOCK-JAI-D5', event_type: 'MAINTENANCE', event_start_ts: '2026-08-04T18:00:00+05:30', event_end_ts: '2026-08-04T22:00:00+05:30', reason: 'Planned refrigeration power maintenance', created_at: '2026-08-01T14:00:00+05:30' },
  { dock_event_id: 'DEVT003', dock_id: 'DOCK-JAI-D2', event_type: 'CAPACITY_REDUCTION', event_start_ts: '2026-08-04T08:00:00+05:30', event_end_ts: '2026-08-04T09:20:00+05:30', reason: 'Unload overrun from prior shift reduced turnover speed', created_at: '2026-08-04T08:05:00+05:30' },
];

export const INITIAL_CARRIERS: Carrier[] = [
  { carrier_id: 'CAR001', carrier_name: 'NorthStar Roadways', contact_email: 'ops@northstar.example', contact_phone: '+91-124-4101001', active_flag: 1 },
  { carrier_id: 'CAR002', carrier_name: 'Aravali Freight Lines', contact_email: 'control@aravalifreight.example', contact_phone: '+91-141-4102002', active_flag: 1 },
  { carrier_id: 'CAR003', carrier_name: 'Shakti Transport Services', contact_email: 'desk@shaktitransport.example', contact_phone: '+91-11-4103003', active_flag: 1 },
  { carrier_id: 'CAR004', carrier_name: 'BlueRoute Logistics', contact_email: 'dispatch@blueroute.example', contact_phone: '+91-22-4104004', active_flag: 1 },
];

export const INITIAL_DRIVERS: Driver[] = [
  { driver_id: 'DRV001', carrier_id: 'CAR001', driver_name: 'Rajesh Kumar', email: 'driver01@gmail.com', password: 'Password#Drv01', phone: '+91-9000010001', licence_number: 'RJ14DL1001', home_base_city: 'Jaipur', driver_status: 'ACTIVE' },
  { driver_id: 'DRV002', carrier_id: 'CAR001', driver_name: 'Imran Khan', email: 'driver02@gmail.com', password: 'Password#Drv02', phone: '+91-9000010002', licence_number: 'HR26DL1002', home_base_city: 'Gurugram', driver_status: 'ACTIVE' },
  { driver_id: 'DRV003', carrier_id: 'CAR002', driver_name: 'Mukesh Yadav', email: 'driver03@gmail.com', password: 'Password#Drv03', phone: '+91-9000010003', licence_number: 'RJ32DL1003', home_base_city: 'Alwar', driver_status: 'ACTIVE' },
  { driver_id: 'DRV004', carrier_id: 'CAR002', driver_name: 'Sandeep Meena', email: 'driver04@gmail.com', password: 'Password#Drv04', phone: '+91-9000010004', licence_number: 'RJ14DL1004', home_base_city: 'Jaipur', driver_status: 'ACTIVE' },
  { driver_id: 'DRV005', carrier_id: 'CAR003', driver_name: 'Gurpreet Singh', email: 'driver05@gmail.com', password: 'Password#Drv05', phone: '+91-9000010005', licence_number: 'PB10DL1005', home_base_city: 'Ludhiana', driver_status: 'ACTIVE' },
  { driver_id: 'DRV006', carrier_id: 'CAR003', driver_name: 'Manoj Sharma', email: 'driver06@gmail.com', password: 'Password#Drv06', phone: '+91-9000010006', licence_number: 'UP14DL1006', home_base_city: 'Ghaziabad', driver_status: 'ACTIVE' },
  { driver_id: 'DRV007', carrier_id: 'CAR004', driver_name: 'Nitin Patil', email: 'driver07@gmail.com', password: 'Password#Drv07', phone: '+91-9000010007', licence_number: 'MH04DL1007', home_base_city: 'Mumbai', driver_status: 'ACTIVE' },
  { driver_id: 'DRV008', carrier_id: 'CAR004', driver_name: 'Ashok Prajapat', email: 'driver08@gmail.com', password: 'Password#Drv08', phone: '+91-9000010008', licence_number: 'RJ19DL1008', home_base_city: 'Jodhpur', driver_status: 'ACTIVE' },
  { driver_id: 'DRV009', carrier_id: 'CAR001', driver_name: 'Vikram Solanki', email: 'driver09@gmail.com', password: 'Password#Drv09', phone: '+91-9000010009', licence_number: 'GJ01DL1009', home_base_city: 'Ahmedabad', driver_status: 'ACTIVE' },
  { driver_id: 'DRV010', carrier_id: 'CAR002', driver_name: 'Deepak Saini', email: 'driver10@gmail.com', password: 'Password#Drv10', phone: '+91-9000010010', licence_number: 'HR55DL1010', home_base_city: 'Manesar', driver_status: 'ACTIVE' },
  { driver_id: 'DRV011', carrier_id: 'CAR003', driver_name: 'Ramesh Choudhary', email: 'driver11@gmail.com', password: 'Password#Drv11', phone: '+91-9000010011', licence_number: 'RJ27DL1011', home_base_city: 'Udaipur', driver_status: 'ACTIVE' },
  { driver_id: 'DRV012', carrier_id: 'CAR004', driver_name: 'Arjun Das', email: 'driver12@gmail.com', password: 'Password#Drv12', phone: '+91-9000010012', licence_number: 'WB23DL1012', home_base_city: 'Kolkata', driver_status: 'ACTIVE' },
  { driver_id: 'DRV013', carrier_id: 'CAR001', driver_name: 'Kailash Gurjar', email: 'driver13@gmail.com', password: 'Password#Drv13', phone: '+91-9000010013', licence_number: 'RJ29DL1013', home_base_city: 'Dausa', driver_status: 'ACTIVE' },
  { driver_id: 'DRV014', carrier_id: 'CAR002', driver_name: 'Pradeep Jat', email: 'driver14@gmail.com', password: 'Password#Drv14', phone: '+91-9000010014', licence_number: 'RJ18DL1014', home_base_city: 'Jhunjhunu', driver_status: 'ACTIVE' },
  { driver_id: 'DRV015', carrier_id: 'CAR003', driver_name: 'Mohammed Salim', email: 'driver15@gmail.com', password: 'Password#Drv15', phone: '+91-9000010015', licence_number: 'DL01DL1015', home_base_city: 'Delhi', driver_status: 'ACTIVE' },
];

export const INITIAL_VEHICLE_TYPES: VehicleType[] = [
  { vehicle_type_code: '20FT', description: '20-foot closed-body truck', default_capacity_kg: 9000, refrigerated_flag: 0, typical_dock_type: 'STANDARD' },
  { vehicle_type_code: '32FT_SXL', description: '32-foot single-axle truck', default_capacity_kg: 15000, refrigerated_flag: 0, typical_dock_type: 'STANDARD' },
  { vehicle_type_code: '32FT_MXL', description: '32-foot multi-axle truck', default_capacity_kg: 22000, refrigerated_flag: 0, typical_dock_type: 'STANDARD' },
  { vehicle_type_code: 'REEFER_32', description: '32-foot refrigerated truck', default_capacity_kg: 18000, refrigerated_flag: 1, typical_dock_type: 'REEFER' },
  { vehicle_type_code: 'HEAVY_40', description: '40-foot heavy-duty trailer', default_capacity_kg: 32000, refrigerated_flag: 0, typical_dock_type: 'HEAVY' },
];

export const INITIAL_VEHICLES: Vehicle[] = [
  { vehicle_id: 'VEH001', carrier_id: 'CAR001', vehicle_type_code: '32FT_SXL', registration_number: 'RJ14GT4101', capacity_kg: 14500, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH002', carrier_id: 'CAR001', vehicle_type_code: '32FT_MXL', registration_number: 'HR26GT4102', capacity_kg: 21500, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH003', carrier_id: 'CAR002', vehicle_type_code: '20FT', registration_number: 'RJ32GT4103', capacity_kg: 8500, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH004', carrier_id: 'CAR002', vehicle_type_code: '32FT_SXL', registration_number: 'RJ14GT4104', capacity_kg: 15000, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH005', carrier_id: 'CAR003', vehicle_type_code: 'REEFER_32', registration_number: 'PB10RF4105', capacity_kg: 17500, refrigeration_capable: 1, active_flag: 1 },
  { vehicle_id: 'VEH006', carrier_id: 'CAR003', vehicle_type_code: '32FT_MXL', registration_number: 'UP14GT4106', capacity_kg: 22000, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH007', carrier_id: 'CAR004', vehicle_type_code: 'HEAVY_40', registration_number: 'MH04HV4107', capacity_kg: 32000, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH008', carrier_id: 'CAR004', vehicle_type_code: '32FT_SXL', registration_number: 'RJ19GT4108', capacity_kg: 14500, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH009', carrier_id: 'CAR001', vehicle_type_code: '32FT_MXL', registration_number: 'GJ01GT4109', capacity_kg: 21000, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH010', carrier_id: 'CAR002', vehicle_type_code: 'REEFER_32', registration_number: 'HR55RF4110', capacity_kg: 18000, refrigeration_capable: 1, active_flag: 1 },
  { vehicle_id: 'VEH011', carrier_id: 'CAR003', vehicle_type_code: 'HEAVY_40', registration_number: 'RJ27HV4111', capacity_kg: 31500, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH012', carrier_id: 'CAR004', vehicle_type_code: '20FT', registration_number: 'WB23GT4112', capacity_kg: 9000, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH013', carrier_id: 'CAR001', vehicle_type_code: '32FT_SXL', registration_number: 'RJ29GT4113', capacity_kg: 14800, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH014', carrier_id: 'CAR002', vehicle_type_code: '32FT_MXL', registration_number: 'RJ18GT4114', capacity_kg: 21800, refrigeration_capable: 0, active_flag: 1 },
  { vehicle_id: 'VEH015', carrier_id: 'CAR003', vehicle_type_code: '20FT', registration_number: 'DL01GT4115', capacity_kg: 8800, refrigeration_capable: 0, active_flag: 1 },
];

export const INITIAL_SHIPMENTS: Shipment[] = [
  { shipment_id: 'SHP1001', order_reference: 'ORD-260804-001', carrier_id: 'CAR001', driver_id: 'DRV001', vehicle_id: 'VEH001', origin_name: 'Neemrana Auto Components', origin_city: 'Neemrana', destination_facility_id: 'FAC-JAI-01', customer_name: 'RajRetail Distribution', product_category: 'Auto components', load_weight_kg: 12000, pallet_count: 22, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'NORMAL', planned_departure_ts: '2026-08-04T04:30:00+05:30', actual_departure_ts: '2026-08-04T04:45:00+05:30', original_eta_ts: '2026-08-04T07:50:00+05:30', latest_eta_ts: '2026-08-04T07:35:00+05:30', expected_unload_min: 50, current_status: 'COMPLETED', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T08:50:00+05:30' },
  { shipment_id: 'SHP1002', order_reference: 'ORD-260804-002', carrier_id: 'CAR001', driver_id: 'DRV002', vehicle_id: 'VEH002', origin_name: 'Manesar Consumer Goods Plant', origin_city: 'Manesar', destination_facility_id: 'FAC-JAI-01', customer_name: 'RajRetail Distribution', product_category: 'FMCG', load_weight_kg: 19000, pallet_count: 30, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'HIGH', planned_departure_ts: '2026-08-04T04:15:00+05:30', actual_departure_ts: '2026-08-04T04:25:00+05:30', original_eta_ts: '2026-08-04T07:55:00+05:30', latest_eta_ts: '2026-08-04T07:58:00+05:30', expected_unload_min: 70, current_status: 'IN_DOCK', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T08:10:00+05:30' },
  { shipment_id: 'SHP1003', order_reference: 'ORD-260804-003', carrier_id: 'CAR002', driver_id: 'DRV003', vehicle_id: 'VEH003', origin_name: 'Bhiwadi Packaging Works', origin_city: 'Bhiwadi', destination_facility_id: 'FAC-JAI-01', customer_name: 'SetuHaul Jaipur DC', product_category: 'Packaging material', load_weight_kg: 7000, pallet_count: 16, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'LOW', planned_departure_ts: '2026-08-04T05:00:00+05:30', actual_departure_ts: '2026-08-04T05:05:00+05:30', original_eta_ts: '2026-08-04T08:50:00+05:30', latest_eta_ts: '2026-08-04T08:20:00+05:30', expected_unload_min: 45, current_status: 'WAITING', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T08:25:00+05:30' },
  { shipment_id: 'SHP1004', order_reference: 'ORD-260804-004', carrier_id: 'CAR002', driver_id: 'DRV004', vehicle_id: 'VEH004', origin_name: 'Kota Engineering Supplies', origin_city: 'Kota', destination_facility_id: 'FAC-JAI-01', customer_name: 'IndustrialHub Jaipur', product_category: 'Machine parts', load_weight_kg: 13500, pallet_count: 20, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'NORMAL', planned_departure_ts: '2026-08-04T03:30:00+05:30', actual_departure_ts: '2026-08-04T04:00:00+05:30', original_eta_ts: '2026-08-04T08:45:00+05:30', latest_eta_ts: '2026-08-04T09:20:00+05:30', expected_unload_min: 60, current_status: 'WAITING', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:30:00+05:30' },
  { shipment_id: 'SHP1005', order_reference: 'ORD-260804-005', carrier_id: 'CAR003', driver_id: 'DRV005', vehicle_id: 'VEH006', origin_name: 'Ludhiana Home Appliances', origin_city: 'Ludhiana', destination_facility_id: 'FAC-JAI-01', customer_name: 'NorthWest Retail', product_category: 'Home appliances', load_weight_kg: 20500, pallet_count: 28, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'HIGH', planned_departure_ts: '2026-08-03T21:00:00+05:30', actual_departure_ts: '2026-08-03T21:20:00+05:30', original_eta_ts: '2026-08-04T08:55:00+05:30', latest_eta_ts: '2026-08-04T09:05:00+05:30', expected_unload_min: 75, current_status: 'WAITING', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:20:00+05:30' },
  { shipment_id: 'SHP1006', order_reference: 'ORD-260804-006', carrier_id: 'CAR003', driver_id: 'DRV006', vehicle_id: 'VEH015', origin_name: 'Ghaziabad Medical Devices', origin_city: 'Ghaziabad', destination_facility_id: 'FAC-JAI-01', customer_name: 'CareSupply Rajasthan', product_category: 'Medical devices', load_weight_kg: 7800, pallet_count: 12, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'HIGH', planned_departure_ts: '2026-08-04T04:00:00+05:30', actual_departure_ts: '2026-08-04T04:20:00+05:30', original_eta_ts: '2026-08-04T10:20:00+05:30', latest_eta_ts: '2026-08-04T11:20:00+05:30', expected_unload_min: 45, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:40:00+05:30' },
  { shipment_id: 'SHP1007', order_reference: 'ORD-260804-007', carrier_id: 'CAR004', driver_id: 'DRV007', vehicle_id: 'VEH008', origin_name: 'Ajmer Textile Mill', origin_city: 'Ajmer', destination_facility_id: 'FAC-JAI-01', customer_name: 'StyleMart Rajasthan', product_category: 'Textiles', load_weight_kg: 13000, pallet_count: 24, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'NORMAL', planned_departure_ts: '2026-08-04T06:00:00+05:30', actual_departure_ts: '2026-08-04T06:10:00+05:30', original_eta_ts: '2026-08-04T09:50:00+05:30', latest_eta_ts: '2026-08-04T09:50:00+05:30', expected_unload_min: 60, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:00:00+05:30' },
  { shipment_id: 'SHP1008', order_reference: 'ORD-260804-008', carrier_id: 'CAR004', driver_id: 'DRV008', vehicle_id: 'VEH012', origin_name: 'Jodhpur Handicrafts Cluster', origin_city: 'Jodhpur', destination_facility_id: 'FAC-JAI-01', customer_name: 'HomeCraft Retail', product_category: 'Furniture accessories', load_weight_kg: 6500, pallet_count: 14, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'LOW', planned_departure_ts: '2026-08-04T03:00:00+05:30', actual_departure_ts: null, original_eta_ts: '2026-08-04T09:45:00+05:30', latest_eta_ts: '2026-08-04T09:45:00+05:30', expected_unload_min: 50, current_status: 'CANCELLED', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T08:30:00+05:30' },
  { shipment_id: 'SHP1009', order_reference: 'ORD-260804-009', carrier_id: 'CAR001', driver_id: 'DRV009', vehicle_id: 'VEH009', origin_name: 'Ahmedabad Solar Components', origin_city: 'Ahmedabad', destination_facility_id: 'FAC-JAI-01', customer_name: 'SunGrid Projects', product_category: 'Solar equipment', load_weight_kg: 20000, pallet_count: 26, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'CRITICAL', planned_departure_ts: '2026-08-03T22:00:00+05:30', actual_departure_ts: '2026-08-03T22:10:00+05:30', original_eta_ts: '2026-08-04T10:45:00+05:30', latest_eta_ts: '2026-08-04T10:50:00+05:30', expected_unload_min: 75, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:10:00+05:30' },
  { shipment_id: 'SHP1010', order_reference: 'ORD-260804-010', carrier_id: 'CAR002', driver_id: 'DRV010', vehicle_id: 'VEH010', origin_name: 'Manesar Cold Chain Foods', origin_city: 'Manesar', destination_facility_id: 'FAC-JAI-01', customer_name: 'FreshBasket Jaipur', product_category: 'Frozen foods', load_weight_kg: 16000, pallet_count: 24, required_dock_type: 'REEFER', temperature_control_required: 1, priority_code: 'HIGH', planned_departure_ts: '2026-08-04T06:15:00+05:30', actual_departure_ts: '2026-08-04T06:20:00+05:30', original_eta_ts: '2026-08-04T10:50:00+05:30', latest_eta_ts: '2026-08-04T10:55:00+05:30', expected_unload_min: 55, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:20:00+05:30' },
  { shipment_id: 'SHP1011', order_reference: 'ORD-260804-011', carrier_id: 'CAR003', driver_id: 'DRV011', vehicle_id: 'VEH011', origin_name: 'Udaipur Industrial Machinery', origin_city: 'Udaipur', destination_facility_id: 'FAC-JAI-01', customer_name: 'BuildPro Rajasthan', product_category: 'Industrial machinery', load_weight_kg: 30000, pallet_count: 8, required_dock_type: 'HEAVY', temperature_control_required: 0, priority_code: 'NORMAL', planned_departure_ts: '2026-08-04T02:30:00+05:30', actual_departure_ts: '2026-08-04T02:45:00+05:30', original_eta_ts: '2026-08-04T10:40:00+05:30', latest_eta_ts: '2026-08-04T10:45:00+05:30', expected_unload_min: 90, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T08:50:00+05:30' },
  { shipment_id: 'SHP1012', order_reference: 'ORD-260804-012', carrier_id: 'CAR004', driver_id: 'DRV012', vehicle_id: 'VEH012', origin_name: 'Delhi Electronics Hub', origin_city: 'Delhi', destination_facility_id: 'FAC-JAI-01', customer_name: 'ElectroWorld Jaipur', product_category: 'Consumer electronics', load_weight_kg: 8000, pallet_count: 18, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'NORMAL', planned_departure_ts: '2026-08-04T05:30:00+05:30', actual_departure_ts: '2026-08-04T06:00:00+05:30', original_eta_ts: '2026-08-04T09:45:00+05:30', latest_eta_ts: '2026-08-04T11:10:00+05:30', expected_unload_min: 45, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:35:00+05:30' },
  { shipment_id: 'SHP1013', order_reference: 'ORD-260804-013', carrier_id: 'CAR001', driver_id: 'DRV013', vehicle_id: 'VEH013', origin_name: 'Dausa Agro Supplies', origin_city: 'Dausa', destination_facility_id: 'FAC-JAI-01', customer_name: 'AgriServe Jaipur', product_category: 'Agricultural inputs', load_weight_kg: 14000, pallet_count: 25, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'NORMAL', planned_departure_ts: '2026-08-04T07:00:00+05:30', actual_departure_ts: '2026-08-04T07:10:00+05:30', original_eta_ts: '2026-08-04T10:00:00+05:30', latest_eta_ts: '2026-08-04T11:00:00+05:30', expected_unload_min: 60, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:25:00+05:30' },
  { shipment_id: 'SHP1014', order_reference: 'ORD-260804-014', carrier_id: 'CAR002', driver_id: 'DRV014', vehicle_id: 'VEH014', origin_name: 'Jhunjhunu Healthcare Supplies', origin_city: 'Jhunjhunu', destination_facility_id: 'FAC-JAI-01', customer_name: 'CareSupply Rajasthan', product_category: 'Hospital consumables', load_weight_kg: 21000, pallet_count: 32, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'CRITICAL', planned_departure_ts: '2026-08-04T05:30:00+05:30', actual_departure_ts: '2026-08-04T05:45:00+05:30', original_eta_ts: '2026-08-04T10:15:00+05:30', latest_eta_ts: '2026-08-04T11:25:00+05:30', expected_unload_min: 75, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:50:00+05:30' },
  { shipment_id: 'SHP1015', order_reference: 'ORD-260804-015', carrier_id: 'CAR003', driver_id: 'DRV015', vehicle_id: 'VEH005', origin_name: 'Delhi Dairy Cooperative', origin_city: 'Delhi', destination_facility_id: 'FAC-JAI-01', customer_name: 'FreshBasket Jaipur', product_category: 'Dairy products', load_weight_kg: 15000, pallet_count: 20, required_dock_type: 'REEFER', temperature_control_required: 1, priority_code: 'HIGH', planned_departure_ts: '2026-08-04T12:00:00+05:30', actual_departure_ts: '2026-08-04T12:20:00+05:30', original_eta_ts: '2026-08-04T17:30:00+05:30', latest_eta_ts: '2026-08-04T18:30:00+05:30', expected_unload_min: 60, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T16:30:00+05:30' },
  { shipment_id: 'SHP1016', order_reference: 'ORD-260804-016', carrier_id: 'CAR004', driver_id: 'DRV007', vehicle_id: 'VEH007', origin_name: 'Mumbai Heavy Equipment Yard', origin_city: 'Mumbai', destination_facility_id: 'FAC-JAI-01', customer_name: 'BuildPro Rajasthan', product_category: 'Construction equipment', load_weight_kg: 31000, pallet_count: 6, required_dock_type: 'HEAVY', temperature_control_required: 0, priority_code: 'HIGH', planned_departure_ts: '2026-08-03T18:00:00+05:30', actual_departure_ts: '2026-08-03T18:20:00+05:30', original_eta_ts: '2026-08-04T10:30:00+05:30', latest_eta_ts: '2026-08-04T12:00:00+05:30', expected_unload_min: 90, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:45:00+05:30' },
  { shipment_id: 'SHP1017', order_reference: 'ORD-260804-017', carrier_id: 'CAR001', driver_id: 'DRV001', vehicle_id: 'VEH001', origin_name: 'Neemrana Auto Components', origin_city: 'Neemrana', destination_facility_id: 'FAC-JAI-01', customer_name: 'RajRetail Distribution', product_category: 'Auto components', load_weight_kg: 11500, pallet_count: 20, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'LOW', planned_departure_ts: '2026-08-04T08:00:00+05:30', actual_departure_ts: '2026-08-04T08:15:00+05:30', original_eta_ts: '2026-08-04T12:15:00+05:30', latest_eta_ts: '2026-08-04T12:45:00+05:30', expected_unload_min: 50, current_status: 'IN_TRANSIT', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T10:00:00+05:30' },
  { shipment_id: 'SHP1018', order_reference: 'ORD-260804-018', carrier_id: 'CAR002', driver_id: 'DRV003', vehicle_id: 'VEH003', origin_name: 'Bhiwadi Packaging Works', origin_city: 'Bhiwadi', destination_facility_id: 'FAC-JAI-01', customer_name: 'SetuHaul Jaipur DC', product_category: 'Packaging material', load_weight_kg: 6800, pallet_count: 14, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'LOW', planned_departure_ts: '2026-08-04T08:00:00+05:30', actual_departure_ts: null, original_eta_ts: '2026-08-04T11:50:00+05:30', latest_eta_ts: '2026-08-04T11:50:00+05:30', expected_unload_min: 45, current_status: 'ASSIGNED', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T12:35:00+05:30' },
  { shipment_id: 'SHP1019', order_reference: 'ORD-260804-019', carrier_id: 'CAR004', driver_id: 'DRV008', vehicle_id: 'VEH008', origin_name: 'Jodhpur Handicrafts Cluster', origin_city: 'Jodhpur', destination_facility_id: 'FAC-JAI-01', customer_name: 'HomeCraft Retail', product_category: 'Furniture accessories', load_weight_kg: 11000, pallet_count: 18, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'NORMAL', planned_departure_ts: '2026-08-04T10:00:00+05:30', actual_departure_ts: null, original_eta_ts: '2026-08-04T16:00:00+05:30', latest_eta_ts: '2026-08-04T16:00:00+05:30', expected_unload_min: 60, current_status: 'CANCELLED', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T10:10:00+05:30' },
  { shipment_id: 'SHP1020', order_reference: 'ORD-260804-020', carrier_id: 'CAR002', driver_id: 'DRV004', vehicle_id: 'VEH004', origin_name: 'Kota Engineering Supplies', origin_city: 'Kota', destination_facility_id: 'FAC-JAI-01', customer_name: 'IndustrialHub Jaipur', product_category: 'Machine parts', load_weight_kg: 12500, pallet_count: 18, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'NORMAL', planned_departure_ts: '2026-08-04T13:30:00+05:30', actual_departure_ts: null, original_eta_ts: '2026-08-04T18:00:00+05:30', latest_eta_ts: '2026-08-04T18:00:00+05:30', expected_unload_min: 60, current_status: 'ASSIGNED', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:00:00+05:30' },
  { shipment_id: 'SHP1021', order_reference: 'ORD-260804-021', carrier_id: 'CAR003', driver_id: 'DRV006', vehicle_id: 'VEH015', origin_name: 'Noida Office Supplies', origin_city: 'Noida', destination_facility_id: 'FAC-GGN-01', customer_name: 'SetuHaul Gurugram Cross-Dock', product_category: 'Office supplies', load_weight_kg: 7200, pallet_count: 15, required_dock_type: 'STANDARD', temperature_control_required: 0, priority_code: 'NORMAL', planned_departure_ts: '2026-08-04T10:00:00+05:30', actual_departure_ts: null, original_eta_ts: '2026-08-04T14:00:00+05:30', latest_eta_ts: '2026-08-04T14:00:00+05:30', expected_unload_min: 45, current_status: 'ASSIGNED', created_at: '2026-08-01T12:00:00+05:30', updated_at: '2026-08-04T09:00:00+05:30' },
];

export function generateSlots(): AppointmentSlot[] {
  const slots: AppointmentSlot[] = [];
  const addSlots = (prefix: string, fac: string, dock: string, startHour: number, endHour: number, durMin: number) => {
    let count = 1;
    for (let h = startHour; h < endHour; h += (durMin / 60)) {
      const startH = Math.floor(h);
      const startM = Math.round((h - startH) * 60);
      const nextH = Math.floor(h + durMin / 60);
      const nextM = Math.round(((h + durMin / 60) - nextH) * 60);

      const sHourStr = String(startH).padStart(2, '0');
      const sMinStr = String(startM).padStart(2, '0');
      const eHourStr = String(nextH).padStart(2, '0');
      const eMinStr = String(nextM).padStart(2, '0');

      const slotId = `${prefix}-${String(count).padStart(3, '0')}`;
      count++;

      let status: 'OPEN' | 'BLOCKED' = 'OPEN';
      let blockReason: string | null = null;

      // Special block cases from SQL seed
      if (dock === 'DOCK-JAI-D3' && startH >= 10 && startH < 13) {
        status = 'BLOCKED';
        blockReason = 'Hydraulic leveller breakdown';
      } else if (dock === 'DOCK-JAI-D5' && startH >= 18 && startH < 22) {
        status = 'BLOCKED';
        blockReason = 'Refrigeration power maintenance';
      }

      slots.push({
        slot_id: slotId,
        facility_id: fac,
        dock_id: dock,
        slot_start_ts: `2026-08-04T${sHourStr}:${sMinStr}:00+05:30`,
        slot_end_ts: `2026-08-04T${eHourStr}:${eMinStr}:00+05:30`,
        slot_status: status,
        block_reason: blockReason,
        created_at: '2026-08-01T12:00:00+05:30',
      });
    }
  };

  // Jaipur D1-D5 (60 min each, 08:00 to 22:00)
  addSlots('SLOT-JAI', 'FAC-JAI-01', 'DOCK-JAI-D1', 8, 22, 60);
  addSlots('SLOT-JAI-B', 'FAC-JAI-01', 'DOCK-JAI-D2', 8, 22, 60);
  addSlots('SLOT-JAI-C', 'FAC-JAI-01', 'DOCK-JAI-D3', 8, 22, 60);
  addSlots('SLOT-JAI-D', 'FAC-JAI-01', 'DOCK-JAI-D4', 8, 22, 60);
  addSlots('SLOT-JAI-E', 'FAC-JAI-01', 'DOCK-JAI-D5', 8, 22, 60);
  // Jaipur D6 Heavy (90 min each, 08:00 to 21:30)
  addSlots('SLOT-JAI-F', 'FAC-JAI-01', 'DOCK-JAI-D6', 8, 21.5, 90);

  // Gurugram D1-D3 (60 min each, 09:00 to 18:00)
  addSlots('SLOT-GGN', 'FAC-GGN-01', 'DOCK-GGN-D1', 9, 18, 60);
  addSlots('SLOT-GGN-B', 'FAC-GGN-01', 'DOCK-GGN-D2', 9, 18, 60);
  addSlots('SLOT-GGN-C', 'FAC-GGN-01', 'DOCK-GGN-D3', 9, 18, 60);

  // Normalize specific slot_ids to match SQL seed IDs
  // Jaipur D1: SLOT-JAI-001 to 014
  // Jaipur D2: SLOT-JAI-015 to 028
  // Jaipur D3: SLOT-JAI-029 to 042
  // Jaipur D4: SLOT-JAI-043 to 056
  // Jaipur D5: SLOT-JAI-057 to 070
  // Jaipur D6: SLOT-JAI-071 to 079
  // GGN D1: SLOT-GGN-080 to 088
  // GGN D2: SLOT-GGN-089 to 097
  // GGN D3: SLOT-GGN-098 to 106
  let idx = 1;
  for (const s of slots) {
    if (s.facility_id === 'FAC-JAI-01') {
      s.slot_id = `SLOT-JAI-${String(idx).padStart(3, '0')}`;
    } else {
      s.slot_id = `SLOT-GGN-${String(idx).padStart(3, '0')}`;
    }
    idx++;
  }

  return slots;
}

export const INITIAL_APPOINTMENTS: Appointment[] = [
  { appointment_id: 'APT1001', shipment_id: 'SHP1001', slot_id: 'SLOT-JAI-001', appointment_status: 'COMPLETED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T10:00:00+05:30', confirmed_at: '2026-08-01T10:05:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9001', updated_at: '2026-08-04T08:50:00+05:30' },
  { appointment_id: 'APT1002', shipment_id: 'SHP1002', slot_id: 'SLOT-JAI-015', appointment_status: 'IN_PROGRESS', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T10:10:00+05:30', confirmed_at: '2026-08-01T10:15:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9002', updated_at: '2026-08-04T08:10:00+05:30' },
  { appointment_id: 'APT1003', shipment_id: 'SHP1003', slot_id: 'SLOT-JAI-002', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T10:20:00+05:30', confirmed_at: '2026-08-01T10:25:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9003', updated_at: '2026-08-04T08:25:00+05:30' },
  { appointment_id: 'APT1004', shipment_id: 'SHP1004', slot_id: 'SLOT-JAI-016', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T10:30:00+05:30', confirmed_at: '2026-08-01T10:35:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9004', updated_at: '2026-08-04T09:30:00+05:30' },
  { appointment_id: 'APT1005', shipment_id: 'SHP1005', slot_id: 'SLOT-JAI-030', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T10:40:00+05:30', confirmed_at: '2026-08-01T10:45:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9005', updated_at: '2026-08-04T09:20:00+05:30' },
  { appointment_id: 'APT1006', shipment_id: 'SHP1006', slot_id: 'SLOT-JAI-045', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T10:50:00+05:30', confirmed_at: '2026-08-01T10:55:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9006', updated_at: '2026-08-04T09:40:00+05:30' },
  { appointment_id: 'APT1007', shipment_id: 'SHP1007', slot_id: 'SLOT-JAI-003', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T11:00:00+05:30', confirmed_at: '2026-08-01T11:05:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9007', updated_at: '2026-08-04T09:00:00+05:30' },
  { appointment_id: 'APT1008', shipment_id: 'SHP1008', slot_id: 'SLOT-JAI-017', appointment_status: 'CANCELLED', booking_source: 'PLANNER', is_current: 0, booked_at: '2026-08-01T11:10:00+05:30', confirmed_at: '2026-08-01T11:15:00+05:30', cancelled_at: '2026-08-04T08:20:00+05:30', cancellation_reason: 'Customer cancelled receipt', replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9008', updated_at: '2026-08-04T08:20:00+05:30' },
  { appointment_id: 'APT1009', shipment_id: 'SHP1009', slot_id: 'SLOT-JAI-046', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T11:20:00+05:30', confirmed_at: '2026-08-01T11:25:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9009', updated_at: '2026-08-04T09:10:00+05:30' },
  { appointment_id: 'APT1010', shipment_id: 'SHP1010', slot_id: 'SLOT-JAI-060', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T11:30:00+05:30', confirmed_at: '2026-08-01T11:35:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9010', updated_at: '2026-08-04T09:20:00+05:30' },
  { appointment_id: 'APT1011', shipment_id: 'SHP1011', slot_id: 'SLOT-JAI-073', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T11:40:00+05:30', confirmed_at: '2026-08-01T11:45:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9011', updated_at: '2026-08-04T08:50:00+05:30' },
  { appointment_id: 'APT1012A', shipment_id: 'SHP1012', slot_id: 'SLOT-JAI-003', appointment_status: 'CANCELLED', booking_source: 'PLANNER', is_current: 0, booked_at: '2026-08-01T11:50:00+05:30', confirmed_at: '2026-08-01T11:55:00+05:30', cancelled_at: '2026-08-04T09:40:00+05:30', cancellation_reason: 'Driver ETA moved beyond slot', replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9012', updated_at: '2026-08-04T09:40:00+05:30' },
  { appointment_id: 'APT1013A', shipment_id: 'SHP1013', slot_id: 'SLOT-JAI-018', appointment_status: 'PENDING_CONFIRMATION', booking_source: 'DRIVER_CHAT', is_current: 1, booked_at: '2026-08-04T09:32:00+05:30', confirmed_at: null, cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: null, updated_at: '2026-08-04T09:32:00+05:30' },
  { appointment_id: 'APT1014A', shipment_id: 'SHP1014', slot_id: 'SLOT-JAI-004', appointment_status: 'PENDING_CONFIRMATION', booking_source: 'DRIVER_CHAT', is_current: 1, booked_at: '2026-08-04T09:52:00+05:30', confirmed_at: null, cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: null, updated_at: '2026-08-04T09:52:00+05:30' },
  { appointment_id: 'APT1015A', shipment_id: 'SHP1015', slot_id: 'SLOT-JAI-066', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T12:00:00+05:30', confirmed_at: '2026-08-01T12:05:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9015', updated_at: '2026-08-04T16:30:00+05:30' },
  { appointment_id: 'APT1016A', shipment_id: 'SHP1016', slot_id: 'SLOT-JAI-072', appointment_status: 'CANCELLED', booking_source: 'PLANNER', is_current: 0, booked_at: '2026-08-01T12:10:00+05:30', confirmed_at: '2026-08-01T12:15:00+05:30', cancelled_at: '2026-08-04T09:50:00+05:30', cancellation_reason: 'Heavy vehicle ETA moved beyond slot', replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9016', updated_at: '2026-08-04T09:50:00+05:30' },
  { appointment_id: 'APT1017', shipment_id: 'SHP1017', slot_id: 'SLOT-JAI-005', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T12:20:00+05:30', confirmed_at: '2026-08-01T12:25:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9017', updated_at: '2026-08-04T10:00:00+05:30' },
  { appointment_id: 'APT1018', shipment_id: 'SHP1018', slot_id: 'SLOT-JAI-019', appointment_status: 'NO_SHOW', booking_source: 'PLANNER', is_current: 0, booked_at: '2026-08-01T12:30:00+05:30', confirmed_at: '2026-08-01T12:35:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9018', updated_at: '2026-08-04T12:35:00+05:30' },
  { appointment_id: 'APT1019', shipment_id: 'SHP1019', slot_id: 'SLOT-JAI-051', appointment_status: 'CANCELLED', booking_source: 'PLANNER', is_current: 0, booked_at: '2026-08-01T12:40:00+05:30', confirmed_at: '2026-08-01T12:45:00+05:30', cancelled_at: '2026-08-04T10:10:00+05:30', cancellation_reason: 'Shipment cancelled', replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9019', updated_at: '2026-08-04T10:10:00+05:30' },
  { appointment_id: 'APT1020', shipment_id: 'SHP1020', slot_id: 'SLOT-JAI-025', appointment_status: 'CONFIRMED', booking_source: 'PLANNER', is_current: 1, booked_at: '2026-08-01T12:50:00+05:30', confirmed_at: '2026-08-01T12:55:00+05:30', cancelled_at: null, cancellation_reason: null, replaced_appointment_id: null, warehouse_confirmation_ref: 'WH-JAI-9020', updated_at: '2026-08-04T09:00:00+05:30' },
];

export const INITIAL_ETA_UPDATES: ETAUpdate[] = [
  { eta_update_id: 'ETA001', shipment_id: 'SHP1001', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV001', declared_eta_ts: '2026-08-04T07:35:00+05:30', confidence_code: 'HIGH', delay_reason_code: null, note: 'Reached Jaipur early; approaching gate.', created_at: '2026-08-04T07:10:00+05:30' },
  { eta_update_id: 'ETA002', shipment_id: 'SHP1003', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV003', declared_eta_ts: '2026-08-04T08:20:00+05:30', confidence_code: 'HIGH', delay_reason_code: null, note: 'Arriving earlier than planned.', created_at: '2026-08-04T07:55:00+05:30' },
  { eta_update_id: 'ETA003', shipment_id: 'SHP1004', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV004', declared_eta_ts: '2026-08-04T09:20:00+05:30', confidence_code: 'HIGH', delay_reason_code: 'TRAFFIC', note: 'Traffic at Tonk Road.', created_at: '2026-08-04T08:30:00+05:30' },
  { eta_update_id: 'ETA004', shipment_id: 'SHP1005', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV005', declared_eta_ts: '2026-08-04T09:05:00+05:30', confidence_code: 'HIGH', delay_reason_code: 'TRAFFIC', note: 'Delayed near Jaipur bypass.', created_at: '2026-08-04T08:10:00+05:30' },
  { eta_update_id: 'ETA005', shipment_id: 'SHP1006', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV006', declared_eta_ts: '2026-08-04T10:50:00+05:30', confidence_code: 'MEDIUM', delay_reason_code: 'TRAFFIC', note: 'Traffic after Shahpura.', created_at: '2026-08-04T08:50:00+05:30' },
  { eta_update_id: 'ETA006', shipment_id: 'SHP1006', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV006', declared_eta_ts: '2026-08-04T11:20:00+05:30', confidence_code: 'HIGH', delay_reason_code: 'TRAFFIC', note: 'Traffic worsened; latest estimate.', created_at: '2026-08-04T09:35:00+05:30' },
  { eta_update_id: 'ETA007', shipment_id: 'SHP1012', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV012', declared_eta_ts: '2026-08-04T11:10:00+05:30', confidence_code: 'HIGH', delay_reason_code: 'BREAKDOWN', note: 'Tyre repaired; moving again.', created_at: '2026-08-04T09:30:00+05:30' },
  { eta_update_id: 'ETA008', shipment_id: 'SHP1013', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV013', declared_eta_ts: '2026-08-04T11:00:00+05:30', confidence_code: 'LOW', delay_reason_code: 'OTHER', note: 'Driver said only: late by one hour.', created_at: '2026-08-04T09:20:00+05:30' },
  { eta_update_id: 'ETA009', shipment_id: 'SHP1014', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV014', declared_eta_ts: '2026-08-04T11:25:00+05:30', confidence_code: 'HIGH', delay_reason_code: 'LOADING_DELAY', note: 'Origin loading completed late.', created_at: '2026-08-04T09:45:00+05:30' },
  { eta_update_id: 'ETA010', shipment_id: 'SHP1015', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV015', declared_eta_ts: '2026-08-04T18:30:00+05:30', confidence_code: 'HIGH', delay_reason_code: 'TRAFFIC', note: 'Evening traffic entering Jaipur.', created_at: '2026-08-04T16:25:00+05:30' },
  { eta_update_id: 'ETA011', shipment_id: 'SHP1016', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV007', declared_eta_ts: '2026-08-04T12:00:00+05:30', confidence_code: 'HIGH', delay_reason_code: 'ROUTE_ISSUE', note: 'Diversion for heavy vehicle.', created_at: '2026-08-04T09:40:00+05:30' },
  { eta_update_id: 'ETA012', shipment_id: 'SHP1017', source_type: 'DRIVER_DECLARED', reported_by_driver_id: 'DRV001', declared_eta_ts: '2026-08-04T12:45:00+05:30', confidence_code: 'LOW', delay_reason_code: 'TRAFFIC', note: 'Driver expects arrival between 12:30 and 13:00.', created_at: '2026-08-04T09:55:00+05:30' },
];

export const INITIAL_FACILITY_CHECKINS: FacilityCheckin[] = [
  { checkin_id: 'CHK1001', shipment_id: 'SHP1001', facility_id: 'FAC-JAI-01', gate_in_ts: '2026-08-04T07:35:00+05:30', yard_queue_enter_ts: '2026-08-04T07:36:00+05:30', dock_in_ts: '2026-08-04T07:55:00+05:30', unload_start_ts: '2026-08-04T08:00:00+05:30', unload_end_ts: '2026-08-04T08:42:00+05:30', gate_out_ts: '2026-08-04T08:50:00+05:30', arrival_state: 'EARLY', queue_state: 'COMPLETED', queue_position: null, actual_dock_id: 'DOCK-JAI-D1', notes: 'Completed before planned slot end.', updated_at: '2026-08-04T08:50:00+05:30' },
  { checkin_id: 'CHK1002', shipment_id: 'SHP1002', facility_id: 'FAC-JAI-01', gate_in_ts: '2026-08-04T07:58:00+05:30', yard_queue_enter_ts: '2026-08-04T07:59:00+05:30', dock_in_ts: '2026-08-04T08:05:00+05:30', unload_start_ts: '2026-08-04T08:08:00+05:30', unload_end_ts: null, gate_out_ts: null, arrival_state: 'ON_TIME', queue_state: 'IN_DOCK', queue_position: null, actual_dock_id: 'DOCK-JAI-D2', notes: 'Unload running longer than planned.', updated_at: '2026-08-04T09:10:00+05:30' },
  { checkin_id: 'CHK1003', shipment_id: 'SHP1003', facility_id: 'FAC-JAI-01', gate_in_ts: '2026-08-04T08:20:00+05:30', yard_queue_enter_ts: '2026-08-04T08:21:00+05:30', dock_in_ts: null, unload_start_ts: null, unload_end_ts: null, gate_out_ts: null, arrival_state: 'EARLY', queue_state: 'WAITING_EARLY', queue_position: 1, actual_dock_id: null, notes: 'Arrived 40 minutes before appointment; asking whether an earlier dock is possible.', updated_at: '2026-08-04T08:25:00+05:30' },
  { checkin_id: 'CHK1004', shipment_id: 'SHP1004', facility_id: 'FAC-JAI-01', gate_in_ts: '2026-08-04T09:25:00+05:30', yard_queue_enter_ts: '2026-08-04T09:26:00+05:30', dock_in_ts: null, unload_start_ts: null, unload_end_ts: null, gate_out_ts: null, arrival_state: 'LATE', queue_state: 'WAITING_LATE', queue_position: 3, actual_dock_id: null, notes: 'Original 09:00 slot has started; truck is waiting for a new instruction.', updated_at: '2026-08-04T09:30:00+05:30' },
  { checkin_id: 'CHK1005', shipment_id: 'SHP1005', facility_id: 'FAC-JAI-01', gate_in_ts: '2026-08-04T09:05:00+05:30', yard_queue_enter_ts: '2026-08-04T09:06:00+05:30', dock_in_ts: null, unload_start_ts: null, unload_end_ts: null, gate_out_ts: null, arrival_state: 'LATE', queue_state: 'WAITING_DOCK_UNAVAILABLE', queue_position: 2, actual_dock_id: null, notes: 'Assigned dock D3 failed before truck could be called in.', updated_at: '2026-08-04T09:20:00+05:30' },
];

export const INITIAL_DRIVER_EXCEPTIONS: DriverException[] = [
  { exception_id: 'EXC001', shipment_id: 'SHP1006', driver_id: 'DRV006', thread_id: 'THR001', exception_type: 'TRAFFIC', reported_at: '2026-08-04T09:34:00+05:30', reported_delay_min: 60, declared_eta_ts: '2026-08-04T11:20:00+05:30', earliest_acceptable_ts: '2026-08-04T12:00:00+05:30', latest_acceptable_ts: null, severity_code: 'HIGH', exception_status: 'NEEDS_INFORMATION', description: 'Traffic delay will cause the original 10:00 slot to be missed.', dedupe_key: 'DRV006-SHP1006-20260804-0934' },
  { exception_id: 'EXC002', shipment_id: 'SHP1012', driver_id: 'DRV012', thread_id: 'THR002', exception_type: 'BREAKDOWN', reported_at: '2026-08-04T09:29:00+05:30', reported_delay_min: 85, declared_eta_ts: '2026-08-04T11:10:00+05:30', earliest_acceptable_ts: '2026-08-04T11:10:00+05:30', latest_acceptable_ts: '2026-08-04T13:30:00+05:30', severity_code: 'HIGH', exception_status: 'NEEDS_INFORMATION', description: 'Tyre issue resolved; driver has a downstream commitment.', dedupe_key: 'DRV012-SHP1012-20260804-0929' },
  { exception_id: 'EXC003', shipment_id: 'SHP1013', driver_id: 'DRV013', thread_id: 'THR003', exception_type: 'DELAY', reported_at: '2026-08-04T09:19:00+05:30', reported_delay_min: 60, declared_eta_ts: '2026-08-04T11:00:00+05:30', earliest_acceptable_ts: null, latest_acceptable_ts: null, severity_code: 'MEDIUM', exception_status: 'NEEDS_INFORMATION', description: 'Delay statement is ambiguous and ETA confidence is low.', dedupe_key: 'DRV013-SHP1013-20260804-0919' },
  { exception_id: 'EXC004', shipment_id: 'SHP1014', driver_id: 'DRV014', thread_id: 'THR004', exception_type: 'DELAY', reported_at: '2026-08-04T09:44:00+05:30', reported_delay_min: 70, declared_eta_ts: '2026-08-04T11:25:00+05:30', earliest_acceptable_ts: '2026-08-04T11:25:00+05:30', latest_acceptable_ts: null, severity_code: 'CRITICAL', exception_status: 'WAITING_CONFIRMATION', description: 'Critical shipment competing for limited standard-dock capacity.', dedupe_key: 'DRV014-SHP1014-20260804-0944' },
  { exception_id: 'EXC005', shipment_id: 'SHP1015', driver_id: 'DRV015', thread_id: 'THR005', exception_type: 'TRAFFIC', reported_at: '2026-08-04T16:24:00+05:30', reported_delay_min: 60, declared_eta_ts: '2026-08-04T18:30:00+05:30', earliest_acceptable_ts: '2026-08-04T18:30:00+05:30', latest_acceptable_ts: null, severity_code: 'HIGH', exception_status: 'ESCALATED', description: 'Only compatible reefer dock is unavailable after the new ETA.', dedupe_key: 'DRV015-SHP1015-20260804-1624' },
  { exception_id: 'EXC006', shipment_id: 'SHP1016', driver_id: 'DRV007', thread_id: 'THR006', exception_type: 'DELAY', reported_at: '2026-08-04T09:39:00+05:30', reported_delay_min: 90, declared_eta_ts: '2026-08-04T12:00:00+05:30', earliest_acceptable_ts: '2026-08-04T12:00:00+05:30', latest_acceptable_ts: null, severity_code: 'HIGH', exception_status: 'OPEN', description: 'Heavy vehicle requires D6 and missed the 09:30 heavy-dock slot.', dedupe_key: 'DRV007-SHP1016-20260804-0939' },
  { exception_id: 'EXC007', shipment_id: 'SHP1003', driver_id: 'DRV003', thread_id: 'THR007', exception_type: 'EARLY_ARRIVAL', reported_at: '2026-08-04T08:22:00+05:30', reported_delay_min: 0, declared_eta_ts: '2026-08-04T08:20:00+05:30', earliest_acceptable_ts: null, latest_acceptable_ts: null, severity_code: 'LOW', exception_status: 'OPEN', description: 'Driver arrived early and is asking whether unused capacity can be used.', dedupe_key: 'DRV003-SHP1003-20260804-0822' },
  { exception_id: 'EXC008', shipment_id: 'SHP1004', driver_id: 'DRV004', thread_id: 'THR008', exception_type: 'DELAY', reported_at: '2026-08-04T09:27:00+05:30', reported_delay_min: 35, declared_eta_ts: '2026-08-04T09:20:00+05:30', earliest_acceptable_ts: null, latest_acceptable_ts: null, severity_code: 'MEDIUM', exception_status: 'WAITING_CONFIRMATION', description: 'Driver is already in the yard after missing the slot start.', dedupe_key: 'DRV004-SHP1004-20260804-0927' },
  { exception_id: 'EXC009', shipment_id: 'SHP1006', driver_id: 'DRV006', thread_id: 'THR009', exception_type: 'TRAFFIC', reported_at: '2026-08-04T09:35:02+05:30', reported_delay_min: 60, declared_eta_ts: '2026-08-04T11:20:00+05:30', earliest_acceptable_ts: null, latest_acceptable_ts: null, severity_code: 'LOW', exception_status: 'DUPLICATE', description: 'Duplicate message received through messaging retry.', dedupe_key: 'DRV006-SHP1006-20260804-0934' },
  { exception_id: 'EXC010', shipment_id: null, driver_id: 'DRV004', thread_id: 'THR010', exception_type: 'UNKNOWN', reported_at: '2026-08-04T09:31:00+05:30', reported_delay_min: 45, declared_eta_ts: null, earliest_acceptable_ts: null, latest_acceptable_ts: null, severity_code: 'MEDIUM', exception_status: 'NEEDS_INFORMATION', description: 'Driver has two assignments and did not identify the shipment.', dedupe_key: 'DRV004-UNKNOWN-20260804-0931' },
];

export const INITIAL_CHAT_THREADS: ChatThread[] = [
  { thread_id: 'THR001', driver_id: 'DRV006', shipment_id: 'SHP1006', opened_at: '2026-08-04T09:34:00+05:30', closed_at: null, thread_status: 'OPEN', thread_intent: 'REPORT_DELAY' },
  { thread_id: 'THR002', driver_id: 'DRV012', shipment_id: 'SHP1012', opened_at: '2026-08-04T09:29:00+05:30', closed_at: null, thread_status: 'WAITING_FOR_DRIVER', thread_intent: 'REPORT_DELAY' },
  { thread_id: 'THR003', driver_id: 'DRV013', shipment_id: 'SHP1013', opened_at: '2026-08-04T09:19:00+05:30', closed_at: null, thread_status: 'WAITING_FOR_DRIVER', thread_intent: 'REPORT_DELAY' },
  { thread_id: 'THR004', driver_id: 'DRV014', shipment_id: 'SHP1014', opened_at: '2026-08-04T09:44:00+05:30', closed_at: null, thread_status: 'WAITING_FOR_WAREHOUSE', thread_intent: 'REPORT_DELAY' },
  { thread_id: 'THR005', driver_id: 'DRV015', shipment_id: 'SHP1015', opened_at: '2026-08-04T16:24:00+05:30', closed_at: null, thread_status: 'ESCALATED', thread_intent: 'REPORT_DELAY' },
  { thread_id: 'THR006', driver_id: 'DRV007', shipment_id: 'SHP1016', opened_at: '2026-08-04T09:39:00+05:30', closed_at: null, thread_status: 'OPEN', thread_intent: 'REPORT_DELAY' },
  { thread_id: 'THR007', driver_id: 'DRV003', shipment_id: 'SHP1003', opened_at: '2026-08-04T08:22:00+05:30', closed_at: null, thread_status: 'OPEN', thread_intent: 'EARLY_ARRIVAL' },
  { thread_id: 'THR008', driver_id: 'DRV004', shipment_id: 'SHP1004', opened_at: '2026-08-04T09:27:00+05:30', closed_at: null, thread_status: 'WAITING_FOR_WAREHOUSE', thread_intent: 'CHECK_STATUS' },
  { thread_id: 'THR009', driver_id: 'DRV006', shipment_id: 'SHP1006', opened_at: '2026-08-04T09:35:00+05:30', closed_at: null, thread_status: 'OPEN', thread_intent: 'REPORT_DELAY' },
  { thread_id: 'THR010', driver_id: 'DRV004', shipment_id: null, opened_at: '2026-08-04T09:31:00+05:30', closed_at: null, thread_status: 'WAITING_FOR_DRIVER', thread_intent: 'UNKNOWN' },
  { thread_id: 'THR011', driver_id: 'DRV001', shipment_id: 'SHP1017', opened_at: '2026-08-04T10:02:00+05:30', closed_at: null, thread_status: 'OPEN', thread_intent: 'ASK_SLOT_OPTIONS' },
  { thread_id: 'THR012', driver_id: 'DRV008', shipment_id: 'SHP1019', opened_at: '2026-08-04T10:12:00+05:30', closed_at: '2026-08-04T10:15:00+05:30', thread_status: 'CLOSED', thread_intent: 'CHECK_STATUS' },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  { chat_message_id: 'MSG001', thread_id: 'THR001', sender_type: 'DRIVER', sender_reference: 'DRV006', message_text: 'Traffic after Shahpura. Reaching around 11:20. Any slot after 12?', message_ts: '2026-08-04T09:34:00+05:30', external_message_id: 'wa-9001', is_duplicate: 0, parsed_intent: 'REPORT_DELAY', extracted_eta_ts: '2026-08-04T11:20:00+05:30', requires_human_review: 0 },
  { chat_message_id: 'MSG002', thread_id: 'THR001', sender_type: 'AGENT', sender_reference: 'agent', message_text: 'Your current slot is 10:00–11:00 at Jaipur DC. I can check compatible slots after your declared ETA. Do you have a latest time by which unloading must finish?', message_ts: '2026-08-04T09:34:05+05:30', external_message_id: null, is_duplicate: 0, parsed_intent: 'ASK_MISSING_CONSTRAINT', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG003', thread_id: 'THR002', sender_type: 'DRIVER', sender_reference: 'DRV012', message_text: 'Tyre repaired. I can reach 11:10. I need to leave the warehouse before 1:30 for another pickup.', message_ts: '2026-08-04T09:29:00+05:30', external_message_id: 'wa-9002', is_duplicate: 0, parsed_intent: 'REPORT_DELAY', extracted_eta_ts: '2026-08-04T11:10:00+05:30', requires_human_review: 0 },
  { chat_message_id: 'MSG004', thread_id: 'THR002', sender_type: 'AGENT', sender_reference: 'agent', message_text: 'Understood. Should 1:30 PM be treated as the latest gate-out time or the latest unloading start time?', message_ts: '2026-08-04T09:29:06+05:30', external_message_id: null, is_duplicate: 0, parsed_intent: 'ASK_MISSING_CONSTRAINT', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG005', thread_id: 'THR003', sender_type: 'DRIVER', sender_reference: 'DRV013', message_text: 'I am late by one hour.', message_ts: '2026-08-04T09:19:00+05:30', external_message_id: 'wa-9003', is_duplicate: 0, parsed_intent: 'REPORT_DELAY', extracted_eta_ts: null, requires_human_review: 1 },
  { chat_message_id: 'MSG006', thread_id: 'THR003', sender_type: 'AGENT', sender_reference: 'agent', message_text: 'Does one hour mean your new arrival time is 11:00 AM, or that the delay may continue for another hour?', message_ts: '2026-08-04T09:19:05+05:30', external_message_id: null, is_duplicate: 0, parsed_intent: 'ASK_MISSING_ETA', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG007', thread_id: 'THR004', sender_type: 'DRIVER', sender_reference: 'DRV014', message_text: 'Origin released me late. ETA 11:25. This load is urgent. Can I get the first possible dock?', message_ts: '2026-08-04T09:44:00+05:30', external_message_id: 'wa-9004', is_duplicate: 0, parsed_intent: 'REPORT_DELAY', extracted_eta_ts: '2026-08-04T11:25:00+05:30', requires_human_review: 0 },
  { chat_message_id: 'MSG008', thread_id: 'THR004', sender_type: 'AGENT', sender_reference: 'agent', message_text: 'I found one possible standard-dock slot, but warehouse confirmation is still pending. I will not treat it as confirmed until the scheduling system accepts it.', message_ts: '2026-08-04T09:52:10+05:30', external_message_id: null, is_duplicate: 0, parsed_intent: 'CHECK_STATUS', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG009', thread_id: 'THR005', sender_type: 'DRIVER', sender_reference: 'DRV015', message_text: 'Evening traffic. ETA 6:30. Can the reefer unload tonight?', message_ts: '2026-08-04T16:24:00+05:30', external_message_id: 'wa-9005', is_duplicate: 0, parsed_intent: 'REPORT_DELAY', extracted_eta_ts: '2026-08-04T18:30:00+05:30', requires_human_review: 0 },
  { chat_message_id: 'MSG010', thread_id: 'THR005', sender_type: 'AGENT', sender_reference: 'agent', message_text: 'The reefer dock is planned for maintenance from 6 PM. I cannot find a valid same-day reefer slot from the current schedule, so this needs operations review.', message_ts: '2026-08-04T16:24:08+05:30', external_message_id: null, is_duplicate: 0, parsed_intent: 'ESCALATE_NO_FEASIBLE_SLOT', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG011', thread_id: 'THR006', sender_type: 'DRIVER', sender_reference: 'DRV007', message_text: 'Heavy trailer ETA 12:00. Original heavy-bay slot will be missed. What is next?', message_ts: '2026-08-04T09:39:00+05:30', external_message_id: 'wa-9006', is_duplicate: 0, parsed_intent: 'REPORT_DELAY', extracted_eta_ts: '2026-08-04T12:00:00+05:30', requires_human_review: 0 },
  { chat_message_id: 'MSG012', thread_id: 'THR007', sender_type: 'DRIVER', sender_reference: 'DRV003', message_text: 'I am already at the gate. Can I get a dock now instead of waiting for 9?', message_ts: '2026-08-04T08:22:00+05:30', external_message_id: 'wa-9007', is_duplicate: 0, parsed_intent: 'EARLY_ARRIVAL', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG013', thread_id: 'THR007', sender_type: 'AGENT', sender_reference: 'agent', message_text: 'I can check current dock availability, but arriving early does not automatically give priority over trucks already scheduled or waiting.', message_ts: '2026-08-04T08:22:04+05:30', external_message_id: null, is_duplicate: 0, parsed_intent: 'EXPLAIN_POLICY', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG014', thread_id: 'THR008', sender_type: 'DRIVER', sender_reference: 'DRV004', message_text: 'I reached late and am in the yard. Has a new dock been assigned?', message_ts: '2026-08-04T09:27:00+05:30', external_message_id: 'wa-9008', is_duplicate: 0, parsed_intent: 'CHECK_STATUS', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG015', thread_id: 'THR009', sender_type: 'DRIVER', sender_reference: 'DRV006', message_text: 'Traffic after Shahpura. Reaching around 11:20. Any slot after 12?', message_ts: '2026-08-04T09:35:02+05:30', external_message_id: 'wa-9009', is_duplicate: 1, parsed_intent: 'REPORT_DELAY', extracted_eta_ts: '2026-08-04T11:20:00+05:30', requires_human_review: 0 },
  { chat_message_id: 'MSG016', thread_id: 'THR010', sender_type: 'DRIVER', sender_reference: 'DRV004', message_text: 'I will be late by 45 minutes.', message_ts: '2026-08-04T09:31:00+05:30', external_message_id: 'wa-9010', is_duplicate: 0, parsed_intent: 'REPORT_DELAY', extracted_eta_ts: null, requires_human_review: 1 },
  { chat_message_id: 'MSG017', thread_id: 'THR010', sender_type: 'AGENT', sender_reference: 'agent', message_text: 'You have two shipments assigned today. Are you referring to ORD-260804-004 or the later ORD-260804-020?', message_ts: '2026-08-04T09:31:05+05:30', external_message_id: null, is_duplicate: 0, parsed_intent: 'ASK_SHIPMENT_ID', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG018', thread_id: 'THR011', sender_type: 'DRIVER', sender_reference: 'DRV001', message_text: 'What slots are possible after 1 PM if I reach around 12:45?', message_ts: '2026-08-04T10:02:00+05:30', external_message_id: 'wa-9011', is_duplicate: 0, parsed_intent: 'ASK_SLOT_OPTIONS', extracted_eta_ts: '2026-08-04T12:45:00+05:30', requires_human_review: 0 },
  { chat_message_id: 'MSG019', thread_id: 'THR012', sender_type: 'DRIVER', sender_reference: 'DRV008', message_text: 'Is my 4 PM slot still active?', message_ts: '2026-08-04T10:12:00+05:30', external_message_id: 'wa-9012', is_duplicate: 0, parsed_intent: 'CHECK_STATUS', extracted_eta_ts: null, requires_human_review: 0 },
  { chat_message_id: 'MSG020', thread_id: 'THR012', sender_type: 'AGENT', sender_reference: 'agent', message_text: 'The shipment and its appointment were cancelled. Please contact dispatch before travelling.', message_ts: '2026-08-04T10:12:05+05:30', external_message_id: null, is_duplicate: 0, parsed_intent: 'CANCELLED_SHIPMENT', extracted_eta_ts: null, requires_human_review: 0 },
];
