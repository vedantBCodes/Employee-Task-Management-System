require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const employeeRoutes = require('./routes/employeeRoutes');
const taskRoutes = require('./routes/taskRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use('/api/employees', employeeRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  return res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'unavailable',
  });
});

app.use((err, _req, res, _next) => {
  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyPattern || {})[0];
    const fieldLabels = {
      employeeId: 'Employee ID',
      email: 'Email',
      taskId: 'Task ID',
    };
    const fieldLabel = fieldLabels[duplicateField] || 'Unique value';
    return res.status(409).json({
      success: false,
      error: { message: `${fieldLabel} already exists` },
    });
  }

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(({ path, message }) => ({ path, message }));
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details },
    });
  }

  if (err.type && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    const message =
      err.type === 'entity.too.large'
        ? 'Request body is too large'
        : err.type === 'entity.parse.failed'
          ? 'Request body contains invalid JSON'
          : 'Invalid request body';
    return res.status(err.status).json({ success: false, error: { message } });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: { message: err.message },
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: { message: 'An unexpected server error occurred' },
  });
});

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI must be set to start the API');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    console.error(`Unable to start server: ${error.message}`);
    process.exitCode = 1;
  }
}

startServer();
