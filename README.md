# Pastry Palace v3

A full-stack online bakery. Customers browse pastries and cakes, fill a cart, pay with M-Pesa and follow their order through to delivery. Bakers and admins manage orders, deliveries and sales reports from a dashboard.

**Live demo:** [link, or delete this line if not deployed]
**Status:** [Complete / In progress]

![Home page](Home<img width="1888" height="960" alt="admin dashboard" src="https://github.com/user-attachments/assets/0f4e6e79-366f-4906-830f-b0d715f07615" />
)

## Features

**For customers**
- Browse categories and products, with variants and prices per variant
- Cart that works for guests and merges into the account on login
- Sign up, log in and a profile page
- Checkout with address autocomplete and a map (OpenStreetMap / Google Maps)
- Pay with M-Pesa (Safaricom Daraja STK push), with payment status checks
- Order tracking through a private tracking link, with an order timeline
- Live delivery tracking on a map
- Purchase history and spending stats
- Email notifications, with notification preferences

**For bakers and admins**
- Update order status from the baker view
- Assign delivery drivers and update delivery status
- Admin dashboard with sales reports and PDF download
- Role-based access (staff and admin users)

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Frontend libraries | React Router, TanStack Query, Axios, React Leaflet, Recharts, jsPDF, Framer Motion |
| Backend | Django 6, Django REST Framework |
| Database | SQLite (development) |
| Payments | M-Pesa Daraja API (sandbox by default) |
| Other | Session auth with CSRF, CORS, ReportLab (PDF reports), Pillow and django-versatileimagefield (images) |

## Project structure

```
pastry-palacev3/
├── Pastries_v3/      # Django backend (API, models, M-Pesa and notification services)
│   ├── Pastries_v3/  # project settings and root URLs
│   └── products/     # catalogue, cart, orders, payments, delivery, reports
└── pv3/              # React + TypeScript frontend (Vite)
    └── src/
        ├── components/   # pages and UI (checkout, tracking, admin)
        ├── Contexts/     # auth and cart state
        └── services/     # API clients
```

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Git

### 1. Clone

```bash
git clone https://github.com/calebmuriuki/pastry-palacev3.git
cd pastry-palacev3
```

### 2. Backend

```bash
cd Pastries_v3
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `Pastries_v3/.env` (never commit it):

```
SECRET_KEY=
DEBUG=True
FRONTEND_URL=http://localhost:5173

# M-Pesa Daraja (https://developer.safaricom.co.ke)
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=

# Email notifications (optional)
EMAIL_HOST=
EMAIL_PORT=
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=

# Maps
GOOGLE_MAPS_API_KEY=
BAKERY_LATITUDE=
BAKERY_LONGITUDE=
```

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver        # http://localhost:8000
```

The M-Pesa callback URL must be reachable from the internet, so use a tunnel such as ngrok when testing payments locally.

### 3. Frontend

```bash
cd pv3
npm install
```

Create `pv3/.env`:

```
VITE_API_BASE_URL=http://localhost:8000/api
```

```bash
npm run dev
```

## API overview

| Area | Example endpoints |
| --- | --- |
| Auth | `/api/auth/register/`, `/api/auth/login/`, `/api/auth/logout/` |
| Catalogue | `/api/categories/`, `/api/products/` |
| Cart | `/api/cart/`, `/api/cart/add/`, `/api/cart/merge/` |
| Orders | `/api/create-order/`, `/api/orders/<id>/`, `/api/track/<token>/` |
| Payments | `/api/payments/mpesa/callback/`, `/api/payments/status/<order_id>/` |
| Delivery | `/api/delivery/tracking/<token>/`, `/api/delivery/assign/<order_id>/` |
| Reports | `/api/reports/data/`, `/api/reports/download/` |

## Engineering notes

- Moved notification logic into its own service module to remove a circular import between Django signals and views.
- Delivery uses a tracking token, so customers can follow an order without logging in.
- [Add one more thing you are proud of, e.g. how you handled the M-Pesa callback or the guest cart merge.]

## Roadmap

- [Move from SQLite to PostgreSQL for production]
- [Automated tests for orders and payments]
- [Deploy backend and frontend]

## Author

**Caleb Muriuki** | [GitHub](https://github.com/calebmuriuki) | [LinkedIn](https://www.linkedin.com/in/caleb-muriuki) | muriukicaleb3@gmail.com
