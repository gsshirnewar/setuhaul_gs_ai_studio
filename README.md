# SetuHaul Freight Operations & Dock Scheduling Platform

SetuHaul is an AI-orchestrated freight operations, automated dock appointment scheduling, and driver verification platform with Supabase PostgreSQL concurrency control and Gemini AI dispatch assistance.

---

## 🚀 Quick Vercel Deployment Guide

Deploying SetuHaul on Vercel takes less than 2 minutes. The repository has already been pre-configured with `vercel.json` and a serverless API handler (`/api/index.ts`).

### Step 1: Push or Export to GitHub
1. In AI Studio, click the **Settings / Export** menu and select **Export to GitHub** (or download the ZIP and push to your GitHub account).
2. Ensure your repository contains `vercel.json`, `package.json`, and `/api/index.ts`.

### Step 2: Import into Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** &rarr; **Project**.
3. Select your GitHub repository (`setuhaul-freight-operations` or your custom repo name) and click **Import**.

### Step 3: Configure Project Settings in Vercel
- **Framework Preset**: Vite (automatically detected)
- **Root Directory**: `./` (leave default)
- **Build Command**: `vite build` (or leave default `npm run build`)
- **Output Directory**: `dist` (leave default)

### Step 4: Add Environment Variables in Vercel
In the **Environment Variables** section before deploying, add the following 3 variables:

| Variable Name | Value Description | Example / Fallback |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Your Google Gemini API Key | *(From Google AI Studio)* |
| `VITE_SUPABASE_URL` | Your Supabase Project URL | `https://ivjuhthqecntjywfyrag.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anonymous Public Key | `eyJhbGciOi...` |

*(Note: If you leave `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` blank, the app will automatically use the pre-configured default Supabase instance).*

### Step 5: Click Deploy
Click **Deploy**. Vercel will build the frontend assets and provision the `/api` serverless routes. Once deployed, Vercel will generate your live production URL (e.g. `https://your-app.vercel.app`).

---

## 🧪 Step-by-Step Testing Guide

### Test 1: Concurrency Control & Contention Handling
*Goal: Prove that two drivers requesting the same dock slot cannot overwrite each other.*

1. Open your deployed Vercel URL in **two different browser windows** (or one regular window and one Incognito window).
2. In **Window A**:
   - Log in as Driver **DRV001 (Rajesh Kumar)** or use the top Driver Selector.
   - Go to **Appointment Scheduling** or chat with the AI Dispatch Assistant: *"Book Dock Slot D1 at 14:00"*.
3. In **Window B**:
   - Log in as Driver **DRV006 (Vikram Malhotra)**.
   - Attempt to book the exact same slot (**Dock D1 at 14:00**) at the exact same moment.
4. **Expected Outcome**:
   - The first request is granted an atomic **10-minute hold lock** in Supabase (`HOLD_PENDING`).
   - The second request triggers a **Slot Contention Conflict** (HTTP 409).
   - The coordinator receives an immediate real-time contention notification with AI priority recommendations (urgency, cold-chain vs. dry van, SLA risk).

---

### Test 2: Driver Registration & Verification (Supabase Status)
*Goal: Test new driver registration, quarantine in PENDING status, and Supabase synchronization.*

1. On the deployed login screen, click **Register New Driver**.
2. Fill in:
   - Full Name: `Aarav Sharma`
   - Email: `aarav.sharma@example.com`
   - Phone: `+91 98765 43210`
   - Truck Plate: `MH 12 AB 9999`
   - Password: `Password#123`
3. Click **Submit Registration**:
   - The driver is quarantined with `verification_status: 'PENDING'`.
   - The AI Assistant welcomes the driver and explicitly informs them that their account is pending facility coordinator review.
4. Attempting to book shipments while pending displays the friendly pending verification banner.

---

### Test 3: Coordinator Functions & Driver Approval
*Goal: Test coordinator oversight, reviewing credentials, and approving drivers.*

1. In the header bar, click **Switch Role** &rarr; **Facility Coordinator (Jaipur Hub - FAC_JAI_01)**.
2. In the Coordinator Dashboard:
   - Navigate to the **Driver Approvals** tab.
   - You will see the **Supabase Database Bar** showing live table status and counts (`public.drivers`).
   - In the **Pending Approvals** list, find `Aarav Sharma`.
   - Inspect the driver's phone, license, vehicle registration, and carrier details.
3. Click **Verify & Approve**:
   - The status updates instantly to **VERIFIED** in Supabase PostgreSQL.
   - An active operational shipment is dispatched to the driver.
4. Switch back to Driver mode or have the driver refresh their screen:
   - The pending quarantine notice disappears, and full operational access is unlocked!

---

### Test 4: Supabase Live Contention Alerts & Resolution
*Goal: Review contested dock slots and resolve them in the Coordinator Dashboard.*

1. In the **Coordinator Dashboard**, click the **Live Dock Board & Realtime Alerts** tab.
2. If two drivers requested the same slot, the **Slot Contention Alert Banner** lights up with:
   - Contending drivers (e.g. DRV006 vs DRV007).
   - Cargo sensitivity (e.g. Refrigerated Pharmaceuticals vs Dry Grocery).
   - The AI recommendation to award the primary slot to the higher-urgency shipment and re-route the runner-up to an adjacent available dock (e.g. Dock D2).
3. Click **Resolve Contention & Auto-Reroute**:
   - Supabase PostgreSQL updates the winning appointment to `CONFIRMED`.
   - The runner-up is gracefully re-routed to the alternative slot with zero double-booking.
