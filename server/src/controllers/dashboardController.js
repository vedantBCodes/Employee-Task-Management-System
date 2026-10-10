const Employee = require('../models/Employee');
const Task = require('../models/Task');

const TASK_STATUSES = ['Todo', 'In Progress', 'Completed', 'Cancelled'];
const ACTIVE_TASK_STATUSES = ['Todo', 'In Progress'];

async function getDashboardStats(_req, res) {
  const now = new Date();
  const localTodayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [employeeStats, taskStatsResult, employeeWorkload] = await Promise.all([
    Employee.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
        },
      },
    ]),
    Task.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          overdue: [
            { $match: { status: { $nin: ['Completed', 'Cancelled'] }, dueDate: { $type: 'date' } } },
            {
              $match: {
                $expr: {
                  $lt: [
                    { $dateTrunc: { date: '$dueDate', unit: 'day', timezone: localTimeZone } },
                    localTodayStart,
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
        },
      },
    ]),
    Employee.aggregate([
      {
        $lookup: {
          from: Task.collection.name,
          let: { employeeId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$assignedEmployee', '$$employeeId'] },
                    { $in: ['$status', ACTIVE_TASK_STATUSES] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                todo: { $sum: { $cond: [{ $eq: ['$status', 'Todo'] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
                totalActive: { $sum: 1 },
              },
            },
          ],
          as: 'activeTaskCounts',
        },
      },
      {
        $project: {
          _id: 1,
          employeeId: 1,
          fullName: 1,
          department: 1,
          tasks: {
            todo: { $ifNull: [{ $arrayElemAt: ['$activeTaskCounts.todo', 0] }, 0] },
            inProgress: { $ifNull: [{ $arrayElemAt: ['$activeTaskCounts.inProgress', 0] }, 0] },
            totalActive: { $ifNull: [{ $arrayElemAt: ['$activeTaskCounts.totalActive', 0] }, 0] },
          },
        },
      },
      { $sort: { fullName: 1, _id: 1 } },
    ]),
  ]);

  const taskStats = taskStatsResult[0] || {};
  const countsByStatus = Object.fromEntries(
    (taskStats.byStatus || []).map(({ _id, count }) => [_id, count])
  );
  const byStatus = Object.fromEntries(TASK_STATUSES.map((status) => [status, countsByStatus[status] || 0]));

  return res.status(200).json({
    success: true,
    data: {
      employees: {
        total: employeeStats[0]?.total || 0,
        active: employeeStats[0]?.active || 0,
      },
      tasks: {
        total: taskStats.total?.[0]?.count || 0,
        byStatus,
        overdue: taskStats.overdue?.[0]?.count || 0,
      },
      employeeWorkload,
    },
  });
}

module.exports = { getDashboardStats };
