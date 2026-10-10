# Employee & Task Management System

A MERN application built for the Roots Media Marketing developer assignment. It provides a dashboard and tools for maintaining employee records, assigning and tracking work, and exporting task data.

## Features

- Dashboard totals for employees and tasks, task counts by status, overdue count, and active workload by employee.
- Employee creation, listing, viewing, editing, and deletion with server-side pagination and schema validation.
- Task creation, listing, viewing, editing, status transitions, filtering, search, sorting, pagination, and CSV export.
- Backend enforcement of employee eligibility, inclusive leave dates, and the three-active-task limit.
- Historical employee snapshots on tasks so task history remains readable after eligible employee deletion.
- Responsive React layout with loading, error, retry, and empty states.

## Technology stack

- Frontend: React 19, Vite, React Router, and CSS.
- Backend: Node.js, Express 5, Mongoose 9, MongoDB, `cors`, and `dotenv`.
- Backend development server: `nodemon`.

The frontend and backend are separate projects with their own `package.json` and lockfile.

## Project structure

```text
.
├── client/
│   ├── src/
│   │   ├── api/                 # Frontend API clients and base URL
│   │   ├── components/          # Layout, forms, details, and shared UI
│   │   └── pages/               # Dashboard, Employees, and Tasks pages
│   ├── .env.example
│   └── package.json
├── server/
│   ├── scripts/verify-business-rules.js
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

## Prerequisites

- Node.js with npm. Use a current Node.js release compatible with the installed Vite and Mongoose versions.
- MongoDB running locally as a replica set, or another MongoDB replica-set URI available to the backend.
- `mongosh` for initializing a local replica set.

## Installation and local run

Install the backend and frontend dependencies in separate terminals or run these commands from the repository root:

```sh
cd server
npm ci
cp .env.example .env
```

Configure `server/.env` as described below, then start the API:

```sh
cd server
npm run dev
```

In another terminal, install and start the frontend:

```sh
cd client
npm ci
cp .env.example .env
npm run dev
```

Open the local URL printed by Vite. The frontend defaults to the API at `http://localhost:5001/api`.

## MongoDB replica-set setup

Task creation, status changes, task edits/deletion that affect active-task counts, and guarded employee deletion use MongoDB transactions. MongoDB transactions require a replica set (including a single-node local replica set); a standalone `mongod` is not sufficient. Transaction-dependent operations return a service-unavailable response if the deployment does not support transactions.

For a local development MongoDB instance, start `mongod` with replica-set mode and a local-only bind address. Supply a data directory appropriate for your machine:

```sh
mongod --replSet rs0 --dbpath /path/to/your/mongodb-data --bind_ip 127.0.0.1
```

In another terminal, initialize the set once:

```sh
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
```

Wait for the member to become primary (`rs.status()` in `mongosh`) before starting the backend. If MongoDB is already managed by a local service, configure that service's `mongod` configuration with `replication.replSetName: rs0` and restart it instead of starting a second process. Do not expose an unauthenticated development database to a public network.

## Environment configuration

Copy the example files and adjust values for your local setup. The examples contain placeholders/defaults only; never commit `.env` files or credentials.

### Backend: `server/.env`

Based on `server/.env.example`:

```dotenv
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/employee-task-management?replicaSet=rs0
```

`PORT` is the API listening port (defaults to `5001` when omitted). `MONGODB_URI` must point to the intended database and a transaction-capable replica set.

### Frontend: `client/.env`

Based on `client/.env.example`:

```dotenv
VITE_API_BASE_URL=http://localhost:5001/api
```

Vite exposes this variable to the browser bundle. Set it to the reachable API base URL, including `/api`, when running in another environment. Do not put secrets in `VITE_` variables.

## Useful commands

```sh
# Backend (from server/)
npm run dev
npm start
node scripts/verify-business-rules.js

# Frontend (from client/)
npm run dev
npm run lint
npm run build
npm run preview
```

The business-rule verifier requires `server/.env` to specify a local MongoDB URI with a `replicaSet` query parameter. It derives a unique temporary database name, starts the API against that database, and removes only the employee/task records it created. It does not drop the database. It refuses non-local MongoDB hosts so the configured application database is not used for test writes.

## API reference

All API routes are mounted under `/api`. Successful JSON responses use `{ "success": true, "data": ... }`; list responses also include `pagination`. Errors use `{ "success": false, "error": { "message": ... } }` (validation errors may include `details`).

### Employees

| Method and path | Behavior |
| --- | --- |
| `POST /api/employees` | Create an employee; returns `201`. Required and schema validation applies. Duplicate Employee ID/email returns `409`; invalid input returns `400`. |
| `GET /api/employees?page=1&limit=10` | List employees, sorted newest first, using MongoDB pagination. Defaults: page `1`, limit `10`; limit maximum `100`. Returns employee records and `{ page, limit, total, totalPages }`. |
| `GET /api/employees/:id` | Get one employee. Invalid 24-character hexadecimal ObjectId syntax returns `400`; missing employee returns `404`. |
| `PUT /api/employees/:id` | Partially update supplied employee fields. Omitted fields remain unchanged; immutable/unknown fields are rejected. Schema validators run on save. |
| `DELETE /api/employees/:id` | Delete only if the employee has no `Todo` or `In Progress` tasks. Otherwise returns `400`. Eligible deletion snapshots employee details onto historical tasks in a transaction. |

### Tasks

| Method and path | Behavior |
| --- | --- |
| `POST /api/tasks` | Create a task. Accepts `title`, `description`, `assignedEmployee` (MongoDB employee ID), `department`, `priority`, `startDate`, and `dueDate`. Status starts as `Todo`; task ID is backend-generated. |
| `GET /api/tasks` | List tasks with server-side search, filters, sorting, population/snapshot fallback, overdue flag, and pagination. See query parameters below. |
| `GET /api/tasks/:id` | **Not implemented.** Task details are obtained from the task list response in the current frontend. |
| `PUT /api/tasks/:id` | Edit task details using only the fields accepted by task creation. Completed and Cancelled tasks cannot be edited. Omitted fields are retained. |
| `PUT /api/tasks/:id/status` | Apply an allowed status transition. The request body accepts only `{ "status": "..." }`. |
| `DELETE /api/tasks/:id` | Delete a task by MongoDB ID. |
| `GET /api/tasks/export` | Download all tasks matching supported search, filters, and sorting as `tasks.csv`. Pagination does not limit the export. |

Task-list and export query parameters:

| Parameter | Values / behavior |
| --- | --- |
| `page` | Positive integer; default `1`. |
| `limit` | Positive integer up to `100`; default `10`. |
| `search` | Up to 100 characters; case-insensitive search of task title and assigned employee name. |
| `department` | `Development`, `Design`, `QA`, `HR`, or `Sales`. |
| `priority` | `Low`, `Medium`, `High`, or `Critical`. |
| `status` | `Todo`, `In Progress`, `Completed`, or `Cancelled`. |
| `dueDate` | Exact calendar date in `YYYY-MM-DD` format. Mutually exclusive with the date range. |
| `dueDateFrom`, `dueDateTo` | Inclusive calendar-date range in `YYYY-MM-DD` format; may be used separately or together. |
| `sortBy` | `createdAt` (default), `dueDate`, `priority`, or `title`. Priority order is Critical, High, Medium, Low. |
| `sortOrder` | `asc` or `desc` (default `desc`). |

Filters compose with one another. Invalid/unsupported query values return `400`. A list response has `data` and `pagination: { page, limit, total, totalPages }`. Each task includes populated assigned-employee details when the employee exists, or the saved snapshot when it has been deleted. List requests are aggregated and paginated in MongoDB.

### Dashboard and health

| Method and path | Behavior |
| --- | --- |
| `GET /api/dashboard` | Returns `employees: { total, active }`, `tasks: { total, byStatus, overdue }`, and `employeeWorkload`. Workload includes all existing employees, including those with zero active tasks. |
| `GET /api/health` | Returns `200` with `{ "status": "ok" }` when Mongoose is connected; otherwise returns `503` with `{ "status": "unavailable" }`. |

## Data model and business rules

### Employee

- `employeeId`, `fullName`, `email`, `phone`, `department`, `role`, `joiningDate`, and `status` are required.
- Employee ID and email have unique MongoDB indexes. Email is trimmed, lowercased, and format-validated. Phone accepts a 10-digit Indian mobile number, optionally prefixed with `+91`, with spaces or hyphens permitted.
- Department is one of Development, Design, QA, HR, or Sales. Status is Active, Inactive, or On Leave.
- `skills` is an array of strings and defaults to an empty array.
- `leaveStart` and `leaveEnd` are required for On Leave employees; leave end must be on or after leave start. The model clears leave dates for Active or Inactive status.
- Mongoose timestamps generate `createdAt` and `updatedAt`.

### Task

- `taskId` is generated by the backend with a UUID-based value and has a unique index. `title`, `description`, `assignedEmployee`, `department`, `priority`, `status`, `startDate`, and `dueDate` are validated by the schema; status defaults to Todo. Due date cannot precede start date.
- `assignedEmployee` references an Employee. `assignedEmployeeSnapshot` stores identifying employee details for historical display if that employee is later deleted.
- `completedAt` is optional and is generated by the backend only on an allowed transition to Completed. Clients cannot set it through create, ordinary task edit, or status routes.
- `createdAt` and `updatedAt` are Mongoose timestamps.
- New task assignment rejects Inactive employees and On Leave employees only when the task's start calendar date falls within the inclusive leave interval. Active employees can be assigned subject to capacity.
- An employee may have at most three tasks in `Todo` or `In Progress`. Completed and Cancelled tasks do not count.
- Task status transitions are `Todo` → `In Progress` or `Cancelled`; `In Progress` → `Completed` or `Cancelled`; Completed and Cancelled are terminal.
- A task is overdue when the server's local calendar date is later than its due date and status is neither Completed nor Cancelled. The task list, dashboard, and CSV export use the shared backend calculation.

## Employee deletion and task history

The backend checks for `Todo` and `In Progress` tasks in a transaction and rejects deletion with `400` if any exist. If deletion is permitted, the employee's ID, Employee ID, name, department, role, and status are copied to each existing task's snapshot field before the employee record is removed. Task list population and CSV export fall back to that snapshot when the Employee reference no longer resolves.

## CSV export

`GET /api/tasks/export` accepts the task search, filter, and sort parameters described above and exports every matching task (not just the current page). Columns are Task ID, Title, Description, Employee Name, Department, Priority, Status, Start Date, Due Date, Created Date, Completed Date, and Overdue. Dates and overdue values use the backend's task-list/dashboard rules. Missing employee references use the historical snapshot, then a readable fallback label if none is available.

CSV cells are quoted and embedded double quotes are escaped. Untrusted text beginning with spreadsheet formula characters (`=`, `+`, `-`, `@`) or relevant control characters is prefixed to prevent formula interpretation when opened in common spreadsheet applications. The response is a CSV attachment named `tasks.csv`.

## Frontend pages and URL state

- `/` — dashboard statistics and employee workload.
- `/employees` — employee table, create/view/edit/delete flows, and paginated listing.
- `/tasks` — task table, create/view/edit/status flows, filtering, sorting, pagination, and CSV export.

The Tasks page stores search, department, priority, status, due date, sort field, sort order, and page in the URL query string. Changing a search/filter/sort resets the page to 1; pagination updates the `page` parameter. Refreshing or sharing the URL restores the task-list query state. The browser back/forward controls also follow URL state. The Employees page pagination is held in page state rather than the URL.

## Assignment questions

1. **How are valid status transitions enforced?** The backend status endpoint accepts only a status field and checks the current-to-requested transition against the allowed transition map inside a MongoDB transaction.
2. **How is the completion date generated?** On a successful transition to Completed, the backend sets `completedAt` to the server's current date/time. The client cannot supply it.
3. **How are inactive and on-leave employees handled?** Assignment to Inactive is rejected. For On Leave, the task start calendar date is compared inclusively with the employee leave interval; dates outside it are allowed subject to capacity.
4. **How are filtering and pagination implemented?** The task controller builds MongoDB aggregation stages for employee-name/title search, composable filters, sorting, and a pagination facet. Employee listing uses Mongoose `.skip()`/`.limit()` plus a document count.
5. **How are filters preserved in the URL?** The Tasks page reads/writes query parameters with React Router's `useSearchParams`; search, filters, sorting, and page are reflected there and restored after reload.
6. **How is the race condition for assigning a fourth active task addressed?** Each assignment transaction writes/increments a shared version field on the employee before counting active tasks and inserting. Concurrent transactions for that employee conflict and retry/abort rather than both passing a stale count. This protection depends on MongoDB transaction support from a replica set.

## Limitations and deployment considerations

- There is no authentication or authorization. Do not expose these APIs to the public internet as-is.
- Express currently uses permissive `cors()` configuration. Restrict allowed origins to the deployed frontend before public deployment.
- Configure production MongoDB with authentication, TLS/network restrictions, backups, and replica-set transaction support. Keep credentials in deployment secrets, not the repository or frontend bundle.
- The frontend must be built with a reachable `VITE_API_BASE_URL`; that URL is public client configuration, not a secret. Configure HTTPS and the API CORS allowlist to match the deployed frontend origin.
- No deployment URLs or production hosting configuration are defined in this repository.
