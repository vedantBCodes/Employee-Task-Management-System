const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');

const DEPARTMENTS = ['Development', 'Design', 'QA', 'HR', 'Sales'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const TASK_STATUSES = ['Todo', 'In Progress', 'Completed', 'Cancelled'];

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: [true, 'Task ID is required'],
      default: () => `TASK-${randomUUID()}`,
      immutable: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Task description is required'],
    },
    assignedEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Assigned employee is required'],
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: {
        values: DEPARTMENTS,
        message: '{VALUE} is not a supported department',
      },
    },
    priority: {
      type: String,
      required: [true, 'Priority is required'],
      enum: {
        values: TASK_PRIORITIES,
        message: '{VALUE} is not a supported task priority',
      },
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: TASK_STATUSES,
        message: '{VALUE} is not a supported task status',
      },
      default: 'Todo',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      validate: {
        validator: function (dueDate) {
          return !this.startDate || !dueDate || dueDate >= this.startDate;
        },
        message: 'Due date must be on or after the start date',
      },
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ taskId: 1 }, { unique: true });
taskSchema.index({ assignedEmployee: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
