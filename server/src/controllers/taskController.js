const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Task = require('../models/Task');

const MAX_PAGE = 1_000_000;
const MAX_LIMIT = 100;
const MAX_ACTIVE_TASKS = 3;
const ACTIVE_TASK_STATUSES = ['Todo', 'In Progress'];
const ALLOWED_CREATE_FIELDS = new Set([
  'title',
  'description',
  'assignedEmployee',
  'department',
  'priority',
  'startDate',
  'dueDate',
]);
const EMPLOYEE_DETAILS = 'employeeId fullName department role status';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateCreateBody(body) {
  if (!isPlainObject(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const unsupportedField = Object.keys(body).find((field) => !ALLOWED_CREATE_FIELDS.has(field));
  if (unsupportedField) {
    return { error: `The ${unsupportedField} field cannot be set when creating a task` };
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'assignedEmployee') &&
    (typeof body.assignedEmployee !== 'string' || !/^[a-f\d]{24}$/i.test(body.assignedEmployee))
  ) {
    return { error: 'assignedEmployee must be a valid 24-character MongoDB ID' };
  }

  return { data: body };
}

function readSingleQueryValue(query, key) {
  const value = query[key];
  if (value === undefined) return { value: undefined };
  if (typeof value !== 'string') return { error: `${key} must be provided once as a string` };
  return { value };
}

function parsePositiveInteger(rawValue, key, defaultValue, maxValue) {
  if (rawValue === undefined) return { value: defaultValue };
  if (!/^\d+$/.test(rawValue)) {
    return { error: `${key} must be a positive integer no greater than ${maxValue}` };
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1 || value > maxValue) {
    return { error: `${key} must be a positive integer no greater than ${maxValue}` };
  }

  return { value };
}

function parseCalendarDate(rawValue, key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return { error: `${key} must use YYYY-MM-DD format` };
  }

  const date = new Date(`${rawValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== rawValue) {
    return { error: `${key} must be a valid calendar date` };
  }

  return { value: date };
}

function buildDueDateFilter(query) {
  const exactValue = readSingleQueryValue(query, 'dueDate');
  const fromValue = readSingleQueryValue(query, 'dueDateFrom');
  const toValue = readSingleQueryValue(query, 'dueDateTo');
  const invalidQuery = [exactValue, fromValue, toValue].find((result) => result.error);
  if (invalidQuery) return { error: invalidQuery.error };

  if (exactValue.value !== undefined && (fromValue.value !== undefined || toValue.value !== undefined)) {
    return { error: 'Use dueDate or dueDateFrom/dueDateTo, not both' };
  }

  if (exactValue.value !== undefined) {
    const parsed = parseCalendarDate(exactValue.value, 'dueDate');
    if (parsed.error) return parsed;
    return {
      value: {
        $gte: parsed.value,
        $lte: new Date(parsed.value.getTime() + 24 * 60 * 60 * 1000 - 1),
      },
    };
  }

  const range = {};
  if (fromValue.value !== undefined) {
    const parsed = parseCalendarDate(fromValue.value, 'dueDateFrom');
    if (parsed.error) return parsed;
    range.$gte = parsed.value;
  }
  if (toValue.value !== undefined) {
    const parsed = parseCalendarDate(toValue.value, 'dueDateTo');
    if (parsed.error) return parsed;
    range.$lte = new Date(parsed.value.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    return { error: 'dueDateFrom must be on or before dueDateTo' };
  }

  return { value: Object.keys(range).length > 0 ? range : undefined };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assignmentEligibilityError(employee, startDate) {
  if (employee.status === 'Inactive') {
    return 'Tasks cannot be assigned to an inactive employee';
  }

  if (employee.status === 'On Leave') {
    const leaveStart = employee.leaveStart;
    const leaveEnd = employee.leaveEnd;
    if (!leaveStart || !leaveEnd) {
      return 'The employee leave interval is unavailable';
    }

    const toUtcCalendarDay = (date) =>
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const taskStartDay = toUtcCalendarDay(startDate);
    const leaveStartDay = toUtcCalendarDay(leaveStart);
    const leaveEndDay = toUtcCalendarDay(leaveEnd);

    if (taskStartDay >= leaveStartDay && taskStartDay <= leaveEndDay) {
      return 'Tasks cannot start during the assigned employee leave period';
    }
    return null;
  }

  if (employee.status !== 'Active') {
    return 'The assigned employee is not eligible for task assignment';
  }

  return null;
}

function isTransactionUnsupported(error) {
  return (
    error.code === 20 ||
    error.codeName === 'IllegalOperation' ||
    /Transaction numbers are only allowed|transactions are not supported/i.test(error.message)
  );
}

async function createTask(req, res) {
  const validatedBody = validateCreateBody(req.body);
  if (validatedBody.error) {
    return res.status(400).json({ success: false, error: { message: validatedBody.error } });
  }

  let task;
  try {
    await mongoose.connection.transaction(async (session) => {
      const candidate = new Task(validatedBody.data);
      await candidate.validate();

      const employee = await Employee.findById(candidate.assignedEmployee).session(session);
      if (!employee) {
        const error = new Error('Assigned employee not found');
        error.status = 404;
        throw error;
      }

      const eligibilityError = assignmentEligibilityError(employee, candidate.startDate);
      if (eligibilityError) {
        const error = new Error(eligibilityError);
        error.status = 400;
        throw error;
      }

      // This shared Employee write makes competing transactions for the same employee conflict.
      const employeeWrite = await Employee.updateOne(
        { _id: employee._id },
        { $inc: { taskAssignmentVersion: 1 } },
        { session, timestamps: false }
      );
      if (employeeWrite.matchedCount !== 1) {
        const error = new Error('Assigned employee not found');
        error.status = 404;
        throw error;
      }

      const activeTaskCount = await Task.countDocuments({
        assignedEmployee: employee._id,
        status: { $in: ACTIVE_TASK_STATUSES },
      }).session(session);
      if (activeTaskCount >= MAX_ACTIVE_TASKS) {
        const error = new Error(`An employee may have no more than ${MAX_ACTIVE_TASKS} active tasks`);
        error.status = 400;
        throw error;
      }

      await candidate.save({ session });
      task = candidate;
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({ success: false, error: { message: error.message } });
    }
    if (isTransactionUnsupported(error)) {
      return res.status(503).json({
        success: false,
        error: { message: 'Task assignment requires MongoDB transaction support' },
      });
    }
    throw error;
  }

  await task.populate({ path: 'assignedEmployee', select: EMPLOYEE_DETAILS });

  return res.status(201).json({ success: true, data: task });
}

async function listTasks(req, res) {
  const allowedQueryFields = new Set([
    'page',
    'limit',
    'search',
    'department',
    'priority',
    'status',
    'dueDate',
    'dueDateFrom',
    'dueDateTo',
    'sortBy',
    'sortOrder',
  ]);
  const unsupportedQuery = Object.keys(req.query).find((field) => !allowedQueryFields.has(field));
  if (unsupportedQuery) {
    return res.status(400).json({
      success: false,
      error: { message: `The ${unsupportedQuery} query parameter is not supported` },
    });
  }

  const pageResult = readSingleQueryValue(req.query, 'page');
  const limitResult = readSingleQueryValue(req.query, 'limit');
  if (pageResult.error || limitResult.error) {
    return res.status(400).json({
      success: false,
      error: { message: pageResult.error || limitResult.error },
    });
  }

  const parsedPage = parsePositiveInteger(pageResult.value, 'page', 1, MAX_PAGE);
  const parsedLimit = parsePositiveInteger(limitResult.value, 'limit', 10, MAX_LIMIT);
  if (parsedPage.error || parsedLimit.error) {
    return res.status(400).json({
      success: false,
      error: { message: parsedPage.error || parsedLimit.error },
    });
  }
  const page = parsedPage.value;
  const limit = parsedLimit.value;
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    return res.status(400).json({ success: false, error: { message: 'Requested page is too large' } });
  }

  const searchResult = readSingleQueryValue(req.query, 'search');
  const departmentResult = readSingleQueryValue(req.query, 'department');
  const priorityResult = readSingleQueryValue(req.query, 'priority');
  const statusResult = readSingleQueryValue(req.query, 'status');
  const sortByResult = readSingleQueryValue(req.query, 'sortBy');
  const sortOrderResult = readSingleQueryValue(req.query, 'sortOrder');
  const scalarError = [
    searchResult,
    departmentResult,
    priorityResult,
    statusResult,
    sortByResult,
    sortOrderResult,
  ].find((result) => result.error);
  if (scalarError) {
    return res.status(400).json({ success: false, error: { message: scalarError.error } });
  }

  const search = searchResult.value?.trim();
  if (search && search.length > 100) {
    return res.status(400).json({ success: false, error: { message: 'search cannot exceed 100 characters' } });
  }

  const enumFilters = [
    ['department', departmentResult.value, Task.schema.path('department').enumValues],
    ['priority', priorityResult.value, Task.schema.path('priority').enumValues],
    ['status', statusResult.value, Task.schema.path('status').enumValues],
  ];
  for (const [name, value, allowedValues] of enumFilters) {
    if (value !== undefined && !allowedValues.includes(value)) {
      return res.status(400).json({
        success: false,
        error: { message: `${name} must be one of: ${allowedValues.join(', ')}` },
      });
    }
  }

  const sortBy = sortByResult.value ?? 'createdAt';
  const sortOrder = sortOrderResult.value ?? 'desc';
  const allowedSortFields = ['createdAt', 'dueDate', 'priority', 'title'];
  if (!allowedSortFields.includes(sortBy)) {
    return res.status(400).json({
      success: false,
      error: { message: `sortBy must be one of: ${allowedSortFields.join(', ')}` },
    });
  }
  if (!['asc', 'desc'].includes(sortOrder)) {
    return res.status(400).json({ success: false, error: { message: 'sortOrder must be asc or desc' } });
  }

  const dueDateResult = buildDueDateFilter(req.query);
  if (dueDateResult.error) {
    return res.status(400).json({ success: false, error: { message: dueDateResult.error } });
  }

  const match = {};
  if (departmentResult.value !== undefined) match.department = departmentResult.value;
  if (priorityResult.value !== undefined) match.priority = priorityResult.value;
  if (statusResult.value !== undefined) match.status = statusResult.value;
  if (dueDateResult.value) match.dueDate = dueDateResult.value;

  const pipeline = [{ $match: match }];
  pipeline.push(
    {
      $lookup: {
        from: Employee.collection.name,
        localField: 'assignedEmployee',
        foreignField: '_id',
        as: 'assignedEmployee',
      },
    },
    { $unwind: { path: '$assignedEmployee', preserveNullAndEmptyArrays: true } }
  );

  if (search) {
    const searchPattern = new RegExp(escapeRegExp(search), 'i');
    pipeline.push({
      $match: {
        $or: [{ title: searchPattern }, { 'assignedEmployee.fullName': searchPattern }],
      },
    });
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  let sort;
  if (sortBy === 'priority') {
    pipeline.push({
      $addFields: {
        _priorityRank: {
          $switch: {
            branches: [
              { case: { $eq: ['$priority', 'Critical'] }, then: 0 },
              { case: { $eq: ['$priority', 'High'] }, then: 1 },
              { case: { $eq: ['$priority', 'Medium'] }, then: 2 },
              { case: { $eq: ['$priority', 'Low'] }, then: 3 },
            ],
            default: 4,
          },
        },
      },
    });
    sort = { _priorityRank: sortDirection, _id: -1 };
  } else {
    sort = { [sortBy]: sortDirection, _id: -1 };
  }

  pipeline.push({
    $facet: {
      data: [
        { $sort: sort },
        { $skip: skip },
        { $limit: limit },
        ...(sortBy === 'priority' ? [{ $unset: '_priorityRank' }] : []),
        {
          $project: {
            _id: 1,
            taskId: 1,
            title: 1,
            description: 1,
            assignedEmployee: {
              $cond: [
                { $ifNull: ['$assignedEmployee._id', false] },
                {
                  _id: '$assignedEmployee._id',
                  employeeId: '$assignedEmployee.employeeId',
                  fullName: '$assignedEmployee.fullName',
                  department: '$assignedEmployee.department',
                  role: '$assignedEmployee.role',
                  status: '$assignedEmployee.status',
                },
                null,
              ],
            },
            department: 1,
            priority: 1,
            status: 1,
            startDate: 1,
            dueDate: 1,
            completedAt: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ],
      metadata: [{ $count: 'total' }],
    },
  });

  const [result] = await Task.aggregate(pipeline);
  const tasks = result?.data ?? [];
  const total = result?.metadata[0]?.total ?? 0;

  return res.status(200).json({
    success: true,
    data: tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

module.exports = { createTask, listTasks };
