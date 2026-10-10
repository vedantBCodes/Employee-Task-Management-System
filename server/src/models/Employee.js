const mongoose = require('mongoose');

const DEPARTMENTS = ['Development', 'Design', 'QA', 'HR', 'Sales'];
const EMPLOYEE_STATUSES = ['Active', 'Inactive', 'On Leave'];

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [
        /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?\.)+[A-Z]{2,}$/i,
        'Please enter a valid email address',
      ],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      validate: {
        validator: function (phone) {
          const normalizedPhone = phone.replace(/[\s-]/g, '');
          return /^(?:\+91)?[6-9]\d{9}$/.test(normalizedPhone);
        },
        message: 'Please enter a valid 10-digit Indian mobile number, optionally prefixed with +91',
      },
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: {
        values: DEPARTMENTS,
        message: '{VALUE} is not a supported department',
      },
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
    },
    joiningDate: {
      type: Date,
      required: [true, 'Joining date is required'],
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: EMPLOYEE_STATUSES,
        message: '{VALUE} is not a supported employee status',
      },
    },
    skills: {
      type: [String],
      default: [],
    },
    leaveStart: {
      type: Date,
      required: function () {
        return this.status === 'On Leave';
      },
    },
    leaveEnd: {
      type: Date,
      required: function () {
        return this.status === 'On Leave';
      },
      validate: {
        validator: function (leaveEnd) {
          return (
            this.status !== 'On Leave' ||
            !this.leaveStart ||
            !leaveEnd ||
            leaveEnd >= this.leaveStart
          );
        },
        message: 'Leave end date must be on or after the leave start date',
      },
    },
  },
  {
    timestamps: true,
  }
);

employeeSchema.index({ employeeId: 1 }, { unique: true });
employeeSchema.index({ email: 1 }, { unique: true });

employeeSchema.pre('validate', function () {
  if (this.status !== 'On Leave') {
    this.leaveStart = undefined;
    this.leaveEnd = undefined;
  }
});

module.exports = mongoose.model('Employee', employeeSchema);
