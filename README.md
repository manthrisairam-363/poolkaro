# 🚗 PoolKaro — India's IT Carpool App

> Built for Hyderabad's IT corridor commuters. Post rides, book seats, pay via UPI.

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Clone & Install

```bash
git clone https://github.com/manthrisairam-363/poolkaro.git
cd poolkaro
npm install
```

### Step 2 — Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in:
```
VITE_SUPABASE_URL=https://ftcnczlfqsistjbiwwji.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_from_supabase_dashboard
VITE_RAZORPAY_KEY_ID=rzp_test_your_key (add later)
```

> Get anon key: Supabase Dashboard → Settings → API → anon public key

### Step 3 — Set Up Database

1. Go to your Supabase project
2. Click **SQL Editor** in left sidebar
3. Click **New Query**
4. Copy everything from `supabase_schema.sql`
5. Paste and click **Run**

### Step 4 — Enable Auth Providers

**For Phone OTP:**
1. Supabase Dashboard → Authentication → Providers
2. Enable **Phone** provider
3. (For production, add Twilio SMS credentials)
4. For testing: use Supabase built-in OTP

**For Google Login:**
1. Go to console.cloud.google.com → Create project
2. APIs & Services → Credentials → Create OAuth 2.0 Client
3. Copy Client ID and Secret
4. Supabase → Authentication → Providers → Google → paste credentials

### Step 5 — Run Locally

```bash
npm run dev
```

App runs at: http://localhost:5173

### Step 6 — Deploy to Vercel (Free)

```bash
npm install -g vercel
vercel
```

Or connect GitHub repo to vercel.com — auto-deploys on every push! ✅

---

## 💰 Payment Flow

```
Rider fare: ₹150
Rider pays:  ₹152  (₹150 + ₹2 PoolKaro fee)
Driver gets: ₹148  (₹150 - ₹2 PoolKaro fee)
PoolKaro:    ₹4    per booking
UPI fee:     ₹0    (free for amounts under ₹2000)
```

---

## 🗂️ Project Structure

```
poolkaro/
├── src/
│   ├── pages/
│   │   ├── Login.jsx       ← Phone OTP + Google login
│   │   ├── Onboarding.jsx  ← Role + UPI setup
│   │   ├── Home.jsx        ← Browse & search rides
│   │   └── PostRide.jsx    ← Post your ride
│   ├── components/
│   │   └── BottomNav.jsx
│   ├── lib/
│   │   ├── supabase.js     ← Supabase client
│   │   └── AuthContext.jsx ← Auth state management
│   ├── App.jsx             ← Routes + auth protection
│   └── main.jsx
├── supabase_schema.sql     ← Run this in Supabase
├── .env.example
└── package.json
```

---

## 📱 Pages Built

- [x] Login (Phone OTP + Google)
- [x] Onboarding (role, vehicle, UPI setup)
- [x] Home (browse + search + filter rides)
- [x] Post Ride (with WhatsApp share)
- [ ] Book Ride + Payment (coming next)
- [ ] My Rides
- [ ] Profile & Settings

---

## 🛠️ Tech Stack

| Layer | Tool | Cost |
|---|---|---|
| Frontend | React + Vite | Free |
| Hosting | Vercel | Free |
| Database + Auth | Supabase | Free |
| Payments | Razorpay | 0% on UPI |
| Domain | .in domain | ~₹500/year |
