# Employee & Task Management System — Frontend

This is the frontend of my Employee & Task Management System, built using React and Vite. It provides an interface for managing employees and tasks, viewing dashboard statistics, tracking task progress, and exporting task data to CSV.

## Tech Stack

- React — for building the user interface
- Vite — for development and production builds
- React Router — for page navigation and URL-based task filters
- CSS — for styling and responsive layouts

## Getting Started

### 1. Install dependencies

Navigate to the client directory and install the required packages:

```bash
cd client
npm install
```

### 2. Configure the backend URL

Create a `.env` file in the `client` directory using `.env.example` as a reference.

Set `VITE_API_BASE_URL` to the URL of the backend API. For local development, use:

```env
VITE_API_BASE_URL=http://localhost:5001/api
```

Make sure the backend is running before using the application.

### 3. Start the development server

```bash
npm run dev
```

Vite will display the local URL where you can open the application in your browser.

## Available Features

- View dashboard statistics and employee workloads.
- Add, view, edit, and delete employees.
- Create, view, and edit tasks.
- Update task statuses using the allowed transitions.
- Search, filter, sort, and paginate tasks.
- Export filtered task results to CSV.

The frontend communicates with the Express backend for data retrieval, validation, and business rules.

## Build and Lint

To check the code and create a production build, run:

```bash
npm run lint
npm run build
```

The production files are generated in the `dist` directory.