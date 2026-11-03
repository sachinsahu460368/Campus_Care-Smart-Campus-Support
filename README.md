# CampusCare

CampusCare is a responsive campus complaint management and department analytics prototype. The interface uses React, Vite, React Router, Recharts, and Lucide React. Records are stored in LocalStorage by default and can use the included Python JSON API instead.

## Requirements

- Node.js 18 or newer and npm
- Python 3.9 or newer for the optional API backend

## Start the frontend

From the project folder:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The Vite development server proxies `/api` calls to `http://127.0.0.1:8080`. If the backend is not running, the app uses LocalStorage in the browser.

## Start with the Python backend

In a second terminal, from the project folder:

```powershell
python backend/server.py
```

The backend listens on `http://127.0.0.1:8080`. With it running, refresh the Vite page; the React app detects the API and uses it for loading, complaint creation, status updates, and clearing data. Backend records are persisted in `backend/data/complaints.json`.

Available API routes:

- `GET /api/health`
- `GET /api/complaints` and `GET /api/complaints/{id}`
- `GET /api/stats` and `GET /api/priority`
- `POST /api/complaints`
- `PATCH /api/complaints/{id}`
- `DELETE /api/complaints` (clears complaints while preserving the ID counter)

## Features

- Clickable Wi-Fi, Hostel, Classroom, and Laboratory dashboards.
- Complaint totals, pending/resolved counts, high-severity counts, average resolution time, and department-specific history.
- Recharts views for submission history, problem types, status, and severity. Charts are derived from stored complaints. A one-record history is identified as limited data; the UI does not fabricate historical points.
- Pattern-based recommendations include their reason and appear only after at least two records share a problem type.
- Complaint creation includes category, problem type, description, location, and severity. Statuses follow Raised → In Progress → Resolved.
- Search and category, status, severity, and date filters.
- Four clearly marked prototype sample records are loaded for a new LocalStorage profile. Backend mode starts empty.
- Settings can clear stored complaints after confirmation.

Severity uses transparent rule-based classification in `src/utils/severity.js`; it is not an ML model. Average resolution time uses the stored `updatedAt` timestamp for resolved complaints. Sample records are for demonstration and should not be treated as actual campus history.

## Project structure

```text
src/
  data/initialComplaints.js   Sample records and problem types
  utils/                      Analytics, severity, recommendations
  App.jsx                     Routes, pages, data access, UI
  main.jsx                    React entry point
  index.css                   Responsive application styles
backend/
  server.py                   Python standard-library JSON API
  data/                       Runtime JSON database (ignored by Git)
```

Build the frontend for production with `npm run build`; generated files go to `dist/`.
