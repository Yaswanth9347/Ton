# 🚀 Deployment Guide: V-Ops (Vercel + Neon)

This guide details how to deploy the **V-Ops** full-stack application using **Vercel** (Frontend + Serverless Backend) and **Neon** (PostgreSQL Database).

## 📋 Prerequisites

1.  **GitHub Repository**: Ensure this project is pushed to your GitHub.
2.  **Vercel Account**: [Sign up here](https://vercel.com/signup).
3.  **Neon Account**: [Sign up here](https://neon.tech).

---

## 1️⃣ Database Setup (Neon)

Since Vercel Serverless functions allow for high scalability, standard database connections can be quickly exhausted. **Neon** is recommended because it is serverless-native and offers built-in **Connection Pooling**.

1.  **Create Project**:
    - Log in to your Neon Console.
    - Click **"New Project"**.
    - Name: `v-ops` (or similar).
    - Region: Select a region close to your target users (e.g., US East, Singapore, Mumbai).
    - Database Name: `neondb` (default is fine).
    - Click **Create Project**.

2.  **Get Connection String**:
    - On the **Dashboard**, look for the **Connection Details** section.
    - **IMPORTANT**: Look for a toggle or checkbox that says **"Pooled connection"** or **"Pooling"**. **Enable it**.
    - Copy the connection string. It will look like this:
        ```
        postgres://user:password@ep-random-1234.region.aws.neon.tech/neondb?sslmode=require
        ```
    - Keep this safe; this is your `DATABASE_URL`.

---

## 2️⃣ Vercel Deployment

1.  **Import Project**:
    - Go to your Vercel Dashboard.
    - Click **"Add New..."** -> **"Project"**.
    - Import your `v-ops` repository from GitHub.

2.  **Configure Project**:
    - **Framework Preset**: Vercel should auto-detect **Vite**. If not, select it manually.
    - **Root Directory**: Leave as `./` (Root).

3.  **Environment Variables**:
    Expand the "Environment Variables" section and add the following:

    | Variable Name | Value | Description |
    | :--- | :--- | :--- |
    | `DATABASE_URL` | `postgres://...` | The **Pooled** connection string from Neon. |
    | `JWT_SECRET` | `(Random String)` | A long, secure random string for signing tokens. |
    | `NODE_ENV` | `production` | Optimizes build and runtime. |
    | `VITE_API_URL` | `https://your-app.vercel.app/api` | The URL of your backend key. Set this after first deploy if needed.* |

    *> **Note**: For the first deploy, you might not know your exact Vercel domain. You can perform the deployment, get the domain (e.g., `v-ops.vercel.app`), update `VITE_API_URL` in Settings, and redeploy.*

4.  **Deploy**:
    - Click **Deploy**.
    - Vercel will:
        - Install dependencies (`npm install`).
        - Run `postinstall` (`prisma generate`).
        - Build the Frontend (`vite build`).
        - Deploy Backend API to `api/index.js` (Serverless).

---

## 3️⃣ Database Migration & Seeding

Your deployed application is now running, but the database is empty (no tables). You must run migrations **from your local machine** targeting the production database.

1.  **Open Local Terminal**: Navigate to your project root.
2.  **Run Migration**:
    Replace the URL with your **Neon Connection String**.
    ```bash
    # Linux/Mac
    DATABASE_URL="postgres://user:pass@host/db?sslmode=require" npx prisma migrate deploy --schema=backend/prisma/schema.prisma
    ```
    *This creates all the tables (Users, Govt Bores, etc.) in your Neon DB.*

3.  **Seed Initial Data (Admin User)**:
    Create the default admin account (`admin` / `admin123`).
    ```bash
    # Linux/Mac
    DATABASE_URL="postgres://user:pass@host/db?sslmode=require" node backend/seeds/run.js
    ```

---

## 4️⃣ Verification

1.  Open your Vercel App URL (e.g., `https://v-ops.vercel.app`).
2.  **Login**: Try logging in with the default seeded admin:
    - **Username**: `admin`
    - **Password**: `admin123`
3.  **Check API**: If the dashboard loads correctly, the API is working.

---

## ❓ Troubleshooting

### "Too many connections" Error
- **Cause**: You are not using the Pooled connection string.
- **Fix**: Go to specific Vercel Project Settings > Environment Variables. Update `DATABASE_URL` to use the Neon **Pooled** connection string (contains `-pooler` in the host).

### "500 Internal Server Error" on Login
- **Check Logs**: Go to Vercel Dashboard > Deployments > Click latest deployment > **Functions** tab.
- **Missing Env**: Ensure `JWT_SECRET` is set.
- **DB Connection**: Ensure `DATABASE_URL` is correct and reachable.

### "CORS Error" or "Network Error"
- **Cause**: The Frontend is trying to hit the wrong API URL.
- **Fix**: Check `VITE_API_URL` in Vercel Environment Variables. It must essentially match your Vercel domain with `/api` appended (no trailing slash issues, though the code handles some).
