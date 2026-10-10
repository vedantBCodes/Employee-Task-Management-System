const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Task = require('../models/Task');

const MAX_PAGE = 1_000_000;
const MAX_LIMIT = 100;

const EDITABLE_FIELDS = new Set([
  'employeeId',
  'fullName',
  'email',
  'phone',
  'department',
  'role',
  'joiningDate',
  'status',
  'skills',
  'leaveStart',
  'leaveEnd',
]);

const IMMUTABLE_FIELDS = new Set(['_id', 'id', '__v', 'createdAt', 'updatedAt']);

function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const immutableField = Object.keys(body).find((field) => IMMUTABLE_FIELDS.has(field));
  if (immutableField) {
    return { error: `The ${immutableField} field cannot be changed` };
  }

  const unsupportedField = Object.keys(body).find((field) => !EDITABLE_FIELDS.has(field));
  if (unsupportedField) {
    return { error: `The ${unsupportedField} field is not supported` };
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'skills') &&
    (!Array.isArray(body.skills) || body.skills.some((skill) => typeof skill !== 'string'))
  ) {
    return { error: 'Skills must be an array of strings' };
  }

  return { data: body };
}

function isValidId(id) {
  return /^[a-f\d]{24}$/i.test(id);
}

function sendNotFound(res) {
  return res.status(404).json({
    success: false,
    error: { message: 'Employee not found' },
  });
}

async function createEmployee(req, res) {
  const validatedBody = validateBody(req.body);
  if (validatedBody.error) {
    return res.status(400).json({ success: false, error: { message: validatedBody.error } });
  }

  const employee = await Employee.create(validatedBody.data);
  return res.status(201).json({ success: true, data: employee });
}

async function listEmployees(req, res) {
  const pageValue = req.query.page;
  const limitValue = req.query.limit;
  const page = pageValue === undefined ? 1 : Number(pageValue);
  const limit = limitValue === undefined ? 10 : Number(limitValue);

  if (
    !Number.isFinite(page) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > MAX_PAGE
  ) {
    return res.status(400).json({
      success: false,
      error: { message: `page must be an integer between 1 and ${MAX_PAGE}` },
    });
  }
  if (!Number.isFinite(limit) || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return res.status(400).json({
      success: false,
      error: { message: `limit must be an integer between 1 and ${MAX_LIMIT}` },
    });
  }

  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Requested page is too large' },
    });
  }

  const [employees, total] = await Promise.all([
    Employee.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Employee.countDocuments(),
  ]);

  return res.status(200).json({
    success: true,
    data: employees,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

async function getEmployee(req, res) {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) return sendNotFound(res);

  return res.status(200).json({ success: true, data: employee });
}

async function updateEmployee(req, res) {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
  }

  const validatedBody = validateBody(req.body);
  if (validatedBody.error) {
    return res.status(400).json({ success: false, error: { message: validatedBody.error } });
  }
  if (Object.keys(validatedBody.data).length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Provide at least one employee field to update' },
    });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) return sendNotFound(res);

  Object.assign(employee, validatedBody.data);
  await employee.save();

  return res.status(200).json({ success: true, data: employee });
}

async function deleteEmployee(req, res) {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ success: false, error: { message: 'Invalid employee ID' } });
  }

  try {
    await mongoose.connection.transaction(async (session) => {
      const employee = await Employee.findById(req.params.id).session(session);
      if (!employee) {
        const error = new Error('Employee not found');
        error.status = 404;
        throw error;
      }

      // Coordinate with task assignment transactions so a new active task cannot race deletion.
      await Employee.updateOne(
        { _id: employee._id },
        { $inc: { taskAssignmentVersion: 1 } },
        { session, timestamps: false }
      );

      const activeTaskExists = await Task.exists({
        assignedEmployee: employee._id,
        status: { $in: ['Todo', 'In Progress'] },
      }).session(session);
      if (activeTaskExists) {
        const error = new Error('Cannot delete this employee while they have Todo or In Progress tasks.');
        error.status = 400;
        throw error;
      }

      await Task.updateMany(
        { assignedEmployee: employee._id },
        {
          $set: {
            assignedEmployeeSnapshot: {
              _id: employee._id,
              employeeId: employee.employeeId,
              fullName: employee.fullName,
              department: employee.department,
              role: employee.role,
              status: employee.status,
            },
          },
        },
        { session, timestamps: false }
      );

      await employee.deleteOne({ session });
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({ success: false, error: { message: error.message } });
    }
    if (/Transaction numbers are only allowed|transactions are not supported/i.test(error.message)) {
      return res.status(503).json({
        success: false,
        error: { message: 'Employee deletion requires MongoDB transaction support' },
      });
    }
    throw error;
  }

  return res.status(200).json({
    success: true,
    data: { message: 'Employee deleted successfully' },
  });
}

module.exports = {
  createEmployee,
  listEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
};
