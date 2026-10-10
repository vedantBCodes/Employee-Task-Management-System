function getServerLocalCalendarContext(now = new Date()) {
  return {
    todayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function buildIsOverdueExpression({ todayStart, timeZone }) {
  return {
    $cond: [
      {
        $and: [
          { $eq: [{ $type: '$dueDate' }, 'date'] },
          { $not: [{ $in: ['$status', ['Completed', 'Cancelled']] }] },
        ],
      },
      {
        $lt: [
          { $dateTrunc: { date: '$dueDate', unit: 'day', timezone: timeZone } },
          todayStart,
        ],
      },
      false,
    ],
  };
}

module.exports = { getServerLocalCalendarContext, buildIsOverdueExpression };
