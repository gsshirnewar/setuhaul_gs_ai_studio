-- ==============================================================================
-- SetuHaul: Supabase Drivers Table with Verification Status Schema
-- Execute this script in your Supabase Project SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Create the drivers table
CREATE TABLE IF NOT EXISTS public.drivers (
    driver_id TEXT PRIMARY KEY,
    carrier_id TEXT DEFAULT 'CAR001',
    driver_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    licence_number TEXT,
    home_base_city TEXT,
    driver_status TEXT DEFAULT 'ACTIVE' CHECK (driver_status IN ('ACTIVE','OFF_DUTY','SUSPENDED','INACTIVE')),
    verification_status TEXT DEFAULT 'PENDING' CHECK (verification_status IN ('VERIFIED', 'PENDING', 'REJECTED')),
    approval_status TEXT DEFAULT 'PENDING' CHECK (approval_status IN ('APPROVED', 'PENDING', 'REJECTED')),
    vehicle_registration TEXT,
    registered_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ,
    verified_by TEXT,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    rejection_reason TEXT
);

-- 2. Enable Row Level Security (RLS) and permit application access via Anon Key
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access to drivers" ON public.drivers;
CREATE POLICY "Allow public full access to drivers" ON public.drivers
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Seed initial drivers with verification_status = 'VERIFIED'
INSERT INTO public.drivers (
    driver_id, carrier_id, driver_name, email, password, phone, licence_number, home_base_city, driver_status, verification_status, approval_status, vehicle_registration
) VALUES
('DRV001','CAR001','Rajesh Kumar','driver01@gmail.com','Password#Drv01','+91-9000010001','RJ14DL1001','Jaipur','ACTIVE','VERIFIED','APPROVED','RJ14GT4101'),
('DRV002','CAR001','Imran Khan','driver02@gmail.com','Password#Drv02','+91-9000010002','HR26DL1002','Gurugram','ACTIVE','VERIFIED','APPROVED','HR26GT4102'),
('DRV003','CAR002','Mukesh Yadav','driver03@gmail.com','Password#Drv03','+91-9000010003','RJ32DL1003','Alwar','ACTIVE','VERIFIED','APPROVED','RJ32GT4103'),
('DRV004','CAR002','Sandeep Meena','driver04@gmail.com','Password#Drv04','+91-9000010004','RJ14DL1004','Jaipur','ACTIVE','VERIFIED','APPROVED','RJ14GT4104'),
('DRV005','CAR003','Gurpreet Singh','driver05@gmail.com','Password#Drv05','+91-9000010005','PB10DL1005','Ludhiana','ACTIVE','VERIFIED','APPROVED','PB10RF4105'),
('DRV006','CAR003','Manoj Sharma','driver06@gmail.com','Password#Drv06','+91-9000010006','UP14DL1006','Ghaziabad','ACTIVE','VERIFIED','APPROVED','UP14GT4106'),
('DRV007','CAR004','Nitin Patil','driver07@gmail.com','Password#Drv07','+91-9000010007','MH04DL1007','Mumbai','ACTIVE','VERIFIED','APPROVED','MH04HV4107'),
('DRV008','CAR004','Ashok Prajapat','driver08@gmail.com','Password#Drv08','+91-9000010008','RJ19DL1008','Jodhpur','ACTIVE','VERIFIED','APPROVED','RJ19GT4108'),
('DRV009','CAR001','Vikram Solanki','driver09@gmail.com','Password#Drv09','+91-9000010009','GJ01DL1009','Ahmedabad','ACTIVE','VERIFIED','APPROVED','GJ01GT4109'),
('DRV010','CAR002','Deepak Saini','driver10@gmail.com','Password#Drv10','+91-9000010010','HR55DL1010','Manesar','ACTIVE','VERIFIED','APPROVED','HR55GT4110'),
('DRV011','CAR003','Ramesh Choudhary','driver11@gmail.com','Password#Drv11','+91-9000010011','RJ27DL1011','Udaipur','ACTIVE','VERIFIED','APPROVED','RJ27GT4111'),
('DRV012','CAR004','Arjun Das','driver12@gmail.com','Password#Drv12','+91-9000010012','WB23DL1012','Kolkata','ACTIVE','VERIFIED','APPROVED','WB23GT4112'),
('DRV013','CAR001','Kailash Gurjar','driver13@gmail.com','Password#Drv13','+91-9000010013','RJ29DL1013','Dausa','ACTIVE','VERIFIED','APPROVED','RJ29GT4113'),
('DRV014','CAR002','Pradeep Jat','driver14@gmail.com','Password#Drv14','+91-9000010014','RJ18DL1014','Jhunjhunu','ACTIVE','VERIFIED','APPROVED','RJ18GT4114'),
('DRV015','CAR003','Mohammed Salim','driver15@gmail.com','Password#Drv15','+91-9000010015','DL01DL1015','Delhi','ACTIVE','VERIFIED','APPROVED','DL01RF4115'),
('DRV-PEND-001','CAR001','Dharmendra Verma','d.verma@freightcorp.in','Password#Drv99','+91-9829012345','RJ14DL9901','Jaipur','OFF_DUTY','PENDING','PENDING','RJ14-GC-5521'),
('DRV-PEND-002','CAR002','Jaswinder Singh','jaswinder.trucking@gmail.com','Password#Drv98','+91-9915044321','PB65DL9902','Ludhiana','OFF_DUTY','PENDING','PENDING','PB65-TR-8812')
ON CONFLICT (driver_id) DO UPDATE SET
  verification_status = EXCLUDED.verification_status,
  approval_status = EXCLUDED.approval_status;
