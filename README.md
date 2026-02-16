# JMJ Management System (V-Ops)

An enterprise-grade management system designed for **JMJ Enterprises**, specialized in handling Attendance, Payroll, Leaves, Expenses, and Borewell Operations.

## 🚀 Overview

This application provides a centralized platform for managing employee records, tracking attendance with GPS location, automating payroll generation, and maintaining detailed records of both private and government borewell drilling operations.

## 🛠 Tech Stack

- **Frontend**: React (Vite), React Router, Axios, Lucide Icons, Custom CSS Design System.
- **Backend**: Node.js, Express, Prisma ORM, PostgreSQL.
- **Infrastructure**: Docker & Docker Compose, Nginx.
- **Tools**: PDFKit (Payslip generation), XLSX (Excel processing).

## 📂 Project Structure

```text
.
├── backend/            # Express.js Server
│   ├── prisma/         # Database Schema & Migrations
│   ├── src/            # API Source Code
│   └── uploads/        # User-uploaded receipts/profiles
├── frontend/           # React Application
│   ├── src/            # Frontend Components & Pages
│   └── public/         # Static Assets
├── docker-compose.yml  # Container Orchestration
└── start.sh            # One-click startup script
```

## 🚥 Quick Start

### 1. Requirements
- [Docker](https://www.docker.com/) and Docker Compose.
- Node.js (v18+) for local development.

### 2. Startup
The easiest way to get started is by using the automation script:
```bash
chmod +x start.sh
./start.sh
```
This script will:
1. Verify Docker environment.
2. Setup environment variables.
3. Start the PostgreSQL database container.
4. Run migrations and seed the database with default users (Admin/Supervisor).
5. Start both Frontend and Backend development servers.

### 3. Default Credentials
- **Admin**: `Admin` / `Admin@13`
- **Supervisor**: `User1` / `User@123`

## 📊 Features

- **🛡️ Secure Authentication**: Role-based access control (Admin, Employee, Supervisor).
- **📍 Attendance Tracking**: Check-in/out with GPS location and address logging.
- **💰 Payroll Management**: Automated monthly payroll generation with PDF payslips.
- **🏗️ Borewell Operations**:
  - **Private Bores**: Track client details, depth, casing, and payments.
  - **Govt Bores**: Complex management of govt-funded drilling projects with flattened Excel-style logging.
- **🍽️ Expense Claims**: Employee lunch and travel expense submission with receipt uploads.
- **📅 Leave Management**: Request and approve employee leave requests.

## 📜 Development Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Start both frontend and backend locally |
| `npm run setup` | Install all dependencies and setup database |
| `npm run migrate` | Run Prisma/SQL migrations |
| `npm run seed` | Seed initial database data |
| `npm run docker:up` | Run the entire stack in Docker |

## 📝 Analysis & Known Gaps
Refer to [feature.md](./feature.md) for a detailed audit of current implementation progress and identified improvement areas.
