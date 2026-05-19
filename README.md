# PULSE HOSPITAL - Enterprise Management System (EMR/HMS)

PULSE HOSPITAL is a comprehensive, multi-module Enterprise Resource Planning (ERP) and Electronic Medical Record (EMR) system designed to manage end-to-end hospital operations. It provides a robust, scalable architecture for clinical and administrative management.

---

## 🏗 System Architecture

The project follows a modular, multi-layered architecture to ensure separation of concerns and scalability.

### 1. **Core Components (`/Code/Components`)**
- **DanpheEMR.Core:** Contains shared utilities, infrastructure, and base classes used across the system.
- **DanpheEMR.DalLayer:** The Data Access Layer built with Entity Framework Core, managing all database interactions.
- **DanpheEMR.ServerModel:** Defines the domain entities and data models that map directly to database tables.
- **DanpheEMR.Security:** Implements a Role-Based Access Control (RBAC) system for granular permission management.
- **DanpheEMR.Jobs:** Background workers for scheduled tasks (e.g., automated reporting, notifications).

### 2. **Backend (Web API)**
Located in `/Code/Websites/DanpheEMR/Controllers`, the backend is built with ASP.NET Core. Major service categories include:
- **Billing:** (`BillingController.cs`) Handles invoices, credit notes, and insurance claims.
- **Clinical:** (`ClinicalController.cs`) Manages EMR data, including vitals, notes, and prescriptions.
- **Laboratory:** (`LabController.cs`) Handles test orders, sample tracking, and result validation.
- **Pharmacy:** (`PharmacyController.cs`) Manages inventory, dispensing, and sales.
- **Payroll:** (`PayrollController.cs`) Manages employee attendance, leave requests, and salary processing.

### 3. **Frontend (Angular)**
The frontend is a single-page application located in `/Code/Websites/DanpheEMR/wwwroot/DanpheApp`. It is organized into 40+ specialized modules:
- **`patients`:** Registration, profile management, and insurance mapping.
- **`billing`:** Inpatient/Outpatient billing, deposit management, and insurance clearance.
- **`labs`:** Worklist orchestration, device integration, and result reporting.
- **`payroll-module`:** Attendance tracking, leave workflow, and salary processing.
- **`inventory`:** Procurement lifecycle, central store management, and sub-store requisition.
- **`adt`:** Real-time bed occupancy, admission tracking, and discharge summaries.
- **`pharmacy`:** Narcotics management, dispensing, and real-time inventory synchronization.
- **`radiology`:** Imaging orders, reporting, and PACS integration.
- **`emergency`:** Triage, acute care management, and emergency billing.
- **`accounting`:** Ledger management, fiscal year settings, and financial reporting.
- **`doctors`:** Physician dashboard, EMR access, and incentive tracking.
- **`nursing`:** Ward management, medication administration, and intake/output charts.

---

## 📁 Project Structure breakdown

```bash
├── Code
│   ├── Components           # Domain logic & Data Access Libraries
│   │   ├── DanpheEMR.DalLayer
│   │   ├── DanpheEMR.ServerModel
│   │   └── DanpheEMR.Security
│   ├── Websites
│   │   └── DanpheEMR        # ASP.NET Core Web API & Static Hosting
│   │       ├── Controllers  # API Endpoints
│   │       └── wwwroot      # Angular SPA & Assets
└── Database                 # SQL Scripts & Migrations
```

---

## 🛠 Backend Endpoints (Key Modules)

### **Payroll Module (`PayrollController`)**
- `GET /api/Payroll/LeaveRequest`: Fetch active leave requests.
- `POST /api/Payroll/PostNewLeaveRequest`: Submit a new leave application.
- `PUT /api/Payroll/update-leave-status`: Approval/Cancellation workflow.
- `GET /api/Payroll/GetEmployeelist`: Retrieve muster data for specific month/year.

### **Billing Module (`BillingController`)**
- `POST /api/Billing/PostBillingTransaction`: Process patient invoices.
- `GET /api/Billing/GetOrganizationList`: Fetch insurance/corporate partners.
- `PUT /api/Billing/UpdateBillStatus`: Handle payments and settlements.

---

## 🗄 Database Schema Categories

The database uses a prefixed naming convention for organization:

| Prefix | Module | Responsibilities |
| :--- | :--- | :--- |
| **`PAT_`** | Patient | Demographics, Insurance info, IDs. |
| **`BIL_`** | Billing | Invoices, Transactions, Insurance Claims. |
| **`PROLL_`** | Payroll | Employee Attendance, Leave, Monthly Salary. |
| **`LIS_`** | Lab | Test Requests, Results, Machine Integrations. |
| **`RBAC_`** | Security | Users, Roles, Permissions, Routes. |
| **`ADT_`** | Admission | Bed Info, Admission Records, Discharge logic. |

---

## 🚀 Development Setup

### **Requirements**
- **Runtime:** .NET 8.0 SDK
- **Database:** SQL Server 2022
- **Node.js:** v10.x - v12.x (Legacy Angular support)
- **Tools:** Visual Studio 2022, SQL Server Management Studio (SSMS)

### **Scripts**
In the root directory:
- `run_dev.bat`: Launches the development environment.
- `dotnet watch run`: Starts the backend with auto-reload.
- `npm start`: Starts the Angular development server (from `wwwroot/DanpheApp`).

---

## 💡 Contact & Support
For technical issues or configuration help, please contact the development team at **PULSE HOSPITAL IT Support**.
