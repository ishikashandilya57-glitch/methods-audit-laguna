# 🏭 Methods Audit App — Phase 1

Manufacturing/Operations audit management system built with React + Node.js + MongoDB.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)

---

### Backend Setup

```bash
cd server
npm install
```

Edit `.env` and set your MongoDB URI:
```
MONGO_URI=mongodb://localhost:27017/methods-audit
JWT_SECRET=change_this_to_a_secure_random_string
```

Start the server:
```bash
npm run dev       # development (nodemon)
npm start         # production
```

Server runs on **http://localhost:5000**

---

### Frontend Setup

```bash
cd client
npm install
npm start
```

App runs on **http://localhost:3000**  
(proxies API calls to localhost:5000 automatically)

---

## Deployment

Recommended production setup:

- Frontend: `Firebase Hosting`
- Backend: `Render`
- Database: `MongoDB Atlas`

### 1. MongoDB Atlas

- Create a free cluster in MongoDB Atlas
- Create a database user
- Add your IP or allow access during setup
- Copy the connection string and replace the value in:

`server/.env.example`

Use a database name like:

`methods-audit`

### 2. Backend on Render

This repo includes:

- [render.yaml](/Users/ishikashandilya/methods-audit-app/render.yaml)

Create a new Render Web Service from the `server` folder and set:

- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL`

Optional:

- `JWT_EXPIRE=7d`
- `PORT=5001`

### 3. Frontend on Firebase Hosting

Set the frontend env file before building:

- `REACT_APP_API_URL=https://your-render-service.onrender.com/api`

Build and deploy:

```bash
cd client
npm install
npm run build
cd ..
npm install -g firebase-tools
firebase login
firebase init hosting
```

When Firebase asks:

- use existing project or create one
- public directory: `client/build`
- single-page app rewrite: `No` if it reads `firebase.json`, otherwise `Yes`
- do not overwrite `index.html`

Then deploy:

```bash
firebase deploy
```

### 4. Connect Frontend and Backend

After Firebase gives you the frontend URL:

- put that full URL into Render as `CLIENT_URL`

Example:

`CLIENT_URL=https://methods-audit-app.web.app`

### 5. Important Notes

- The frontend now reads API URL from env instead of hardcoded localhost
- The backend now reads allowed frontend origins from `CLIENT_URL`
- For multiple frontend URLs, use comma-separated values in `CLIENT_URL`
- Firebase Hosting config is in [firebase.json](/Users/ishikashandilya/methods-audit-app/firebase.json)

---

## 📁 What's Included (Phase 1)

### Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login + get JWT |
| GET | /api/auth/me | Get current user |
| GET | /api/audits | List all audits |
| POST | /api/audits | Create audit |
| GET | /api/audits/:id | Get audit detail |
| PUT | /api/audits/:id | Update audit |
| DELETE | /api/audits/:id | Delete audit (manager+) |
| GET | /api/checklists?auditId=xxx | Get checklists for audit |
| POST | /api/checklists | Create checklist |
| GET | /api/checklists/:id | Get checklist |
| PUT | /api/checklists/:id | Update checklist |
| PATCH | /api/checklists/:id/items/:itemId | Update single item response |
| DELETE | /api/checklists/:id | Delete checklist |

### Frontend Pages
- **Login / Register** — JWT authentication
- **Dashboard** — Summary stats + recent audits
- **Audit List** — Filterable table of all audits
- **New Audit** — Create form
- **Audit Detail** — View/update audit, manage checklists
- **Checklist** — Fill in audit items (Pass/Fail/N/A + remarks)

---

## 🔜 Phase 2 (Next)
- Findings & non-conformance logging
- Corrective Action (CAPA) tracking
- Email notifications
- PDF report generation
