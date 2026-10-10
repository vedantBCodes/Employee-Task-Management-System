# Employee & Task Management System

I built this project as part of the Roots Media Marketing developer assignment. It is a MERN stack application for managing employee records, assigning tasks, tracking their progress, and viewing overall team workload.

## Features

- **Dashboard:** View employee counts, task status counts, overdue tasks, and employee workloads.
- **Employee management:** Add, view, edit, and delete employee records.
- **Task management:** Create, view, and edit tasks, and update their status through the allowed transitions.
- **Search and filters:** Find tasks by title or employee name, filter by department, priority, status, and due date, and sort the results.
- **Pagination:** Load employee and task records in pages from the backend.
- **CSV export:** Export all tasks matching the current search, filters, and sorting.
- **Validation:** Enforce employee eligibility, leave dates, task date rules, and the limit of three active tasks per employee.
- **Task history:** Preserve employee details on existing tasks when an employee is deleted.

## Tech Stack

- **Frontend:** React 19, Vite, React Router, CSS
- **Backend:** Node.js, Express 5
- **Database:** MongoDB with Mongoose 9
- **Other tools:** dotenv, CORS, Nodemon

The frontend and backend have separate package files and can be run independently.

## Project Structure

```text
.
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   └── pages/
│   ├── .env.example
│   └── package.json
├── server/
│   ├── scripts/
│   │   └── verify-business-rules.js
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── server.js
│   ├── .env.example
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

Before running the project, make sure you have:

- Node.js and npm installed
- MongoDB configured as a replica set
- `mongosh` available for local replica-set setup

### 1. Set up the backend

From the project root, run:

```bash
cd server
npm ci
cp .env.example .env
```

Open `server/.env` and configure the database connection:

```dotenv
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/employee-task-management?replicaSet=rs0
```

Start the backend:

```bash
npm run dev
```

The API runs on port `5001` with this configuration.

### 2. Set up the frontend

Open another terminal and run:

```bash
cd client
npm ci
cp .env.example .env
```

Configure the frontend API URL in `client/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:5001/api
```

Start the frontend:

```bash
npm run dev
```

Open the local URL printed by Vite in your browser. Make sure the backend is running as well.

## MongoDB Setup

This project uses MongoDB transactions to protect operations such as task assignment and employee deletion. Because of that, MongoDB must run as a replica set; a standalone MongoDB instance is not sufficient.

For a local development instance, you can start MongoDB with replica-set mode enabled:

```bash
mongod --replSet rs0 --dbpath /path/to/your/mongodb-data --bind_ip 127.0.0.1
```

Replace the data directory with a suitable local path.

Initialize the replica set once:

```bash
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
```

Wait for the replica-set member to become primary before starting the backend. If you already run MongoDB as a local service, configure that service instead of starting a second MongoDB process.

Keep local development databases restricted to your own machine.

## Useful Commands

Run these commands from the appropriate directory.

| Command | Purpose |
|---|---|
| `npm run dev` in `server/` | Start the backend in development mode |
| `npm start` in `server/` | Start the backend normally |
| `node scripts/verify-business-rules.js` in `server/` | Verify important backend rules |
| `npm run dev` in `client/` | Start the frontend |
| `npm run lint` in `client/` | Check frontend code |
| `npm run build` in `client/` | Create a production build |
| `npm run preview` in `client/` | Preview the production build |

The business-rule verification script uses an isolated temporary database and cleans up the test records it creates. It requires a local MongoDB replica set and should be run only after configuring the backend environment.

## Main API Endpoints

All endpoints are prefixed with `/api`.

### Employees

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/employees` | Add an employee |
| GET | `/employees` | Get a paginated employee list |
| GET | `/employees/:id` | Get one employee |
| PUT | `/employees/:id` | Update employee details |
| DELETE | `/employees/:id` | Delete an eligible employee |

Employee IDs and email addresses must be unique. Invalid input returns a validation error, while duplicate IDs or emails return `409 Conflict`.

An employee cannot be deleted while they have tasks in `Todo` or `In Progress`. When deletion is allowed, the application saves the employee's details on their existing tasks so that historical records remain readable.

### Tasks

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/tasks` | Create a task |
| GET | `/tasks` | Get tasks with search, filters, sorting, and pagination |
| PUT | `/tasks/:id` | Edit task details |
| PUT | `/tasks/:id/status` | Change task status |
| DELETE | `/tasks/:id` | Delete a task |
| GET | `/tasks/export` | Export matching tasks to CSV |

The task details view currently uses data from the task list response; a separate `GET /tasks/:id` endpoint is not implemented.

The task list supports these query parameters:

- `page` and `limit` for pagination
- `search` for task title and employee name
- `department`, `priority`, and `status` for filtering
- `dueDate` or `dueDateFrom` and `dueDateTo` for due-date filtering
- `sortBy` for `createdAt`, `dueDate`, `priority`, or `title`
- `sortOrder` for ascending or descending order

These filters can be combined. The backend performs filtering, sorting, and pagination in MongoDB rather than fetching all records and filtering them in React.

### Dashboard and Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard` | Get dashboard statistics and employee workload |
| GET | `/health` | Check whether the backend is connected to MongoDB |

The dashboard includes employees with no active tasks, so the workload information covers the full employee list.

## How the Main Rules Work

### Employee records

Each employee has an Employee ID, name, email, phone, department, role, joining date, status, and skills. Employees marked `On Leave` must also have leave start and end dates.

The available departments are Development, Design, QA, HR, and Sales. Employee status can be Active, Inactive, or On Leave.

### Task assignment

Task IDs are generated by the backend, and new tasks start with the status `Todo`.

- Inactive employees cannot be assigned tasks.
- On Leave employees cannot be assigned a task whose start date falls within their leave period, including either boundary date.
- An employee can have at most three active tasks. `Todo` and `In Progress` count as active; Completed and Cancelled do not.
- The due date cannot be earlier than the start date.

The backend checks these rules, including when requests happen at the same time. MongoDB transactions help prevent concurrent requests from exceeding the active-task limit.

### Task status and completion date

The allowed status changes are:

- `Todo` → `In Progress` or `Cancelled`
- `In Progress` → `Completed` or `Cancelled`

Completed and Cancelled tasks are terminal states. Their details cannot be edited, and they cannot be reopened through the status endpoint.

When a task becomes Completed, the backend generates its completion date. The frontend cannot set that date itself.

### Overdue tasks

A task is overdue when the server's local calendar date is later than its due date and its status is neither Completed nor Cancelled.

The task list, dashboard, and CSV export use the same backend calculation.

## CSV Export

The CSV export includes all tasks matching the current search, filters, and sorting—not just the tasks on the current page.

The exported columns include Task ID, Title, Description, Employee Name, Department, Priority, Status, Start Date, Due Date, Created Date, Completed Date, and Overdue.

The backend handles CSV quoting and escaping, including commas, double quotes, and line breaks. It also protects untrusted text values against spreadsheet formula injection.

## Frontend Pages

- `/` — Dashboard
- `/employees` — Employee list and employee management
- `/tasks` — Task list, task forms, status updates, and CSV export

The Tasks page stores search, filters, sorting, and pagination in the URL. This means refreshing or sharing a task-list URL preserves its query state. The Employees page uses page state for pagination.

## Assignment Questions

**1. How are valid status transitions enforced?**

The backend status endpoint checks the current status against the allowed transitions. Invalid transitions are rejected, and the frontend only offers valid next statuses.

**2. How is the completion date generated?**

The backend sets `completedAt` when a task successfully transitions to Completed. The client cannot supply this field.

**3. How are inactive and on-leave employees handled?**

Assignment to an Inactive employee is rejected. For an On Leave employee, the task start date is checked against the inclusive leave interval.

**4. How are filtering and pagination implemented?**

The task controller uses MongoDB aggregation for search, filters, sorting, and pagination. Employee listing uses MongoDB queries with skip, limit, and a document count.

**5. How are filters preserved in the URL?**

The Tasks page uses React Router's `useSearchParams` to store search, filters, sorting, and the current page in the query string. These values are restored when the page is refreshed.

**6. How is the race condition for assigning a fourth active task addressed?**

Task assignment uses a shared employee version-field write within a MongoDB transaction before checking active-task capacity. Concurrent assignments for the same employee therefore conflict instead of both relying on the same stale task count. This requires transaction support from a replica set.

## Before Deployment

There are a few things to consider before making the application publicly available:

- The application currently has no authentication or authorization, as required by the assignment. Do not expose the APIs publicly without considering appropriate access controls.
- Configure CORS to allow only the intended frontend origin when deploying.
- Use a MongoDB deployment that supports transactions, with suitable authentication and network restrictions.
- Set `MONGODB_URI` as a secret environment variable on the backend hosting service.
- Set `VITE_API_BASE_URL` to the deployed API URL when building the frontend. This variable is public configuration, so it must not contain secrets.
- Use HTTPS for the deployed frontend and API.

Deployment URLs are not included because hosting has not yet been configured.