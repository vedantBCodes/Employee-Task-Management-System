/*
 * Integration checks for the Employee & Task Management API.
 * Writes only to a unique temporary database derived from the local server/.env URI.
 * Cleanup removes only document IDs created by this run; it never drops a database.
 */
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');

const serverDirectory = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(serverDirectory, '.env'), quiet: true });

const configuredUri = process.env.MONGODB_URI;
if (!configuredUri) throw new Error('server/.env must define MONGODB_URI');

const databaseUrl = new URL(configuredUri);
if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
  throw new Error('Refusing to run: MONGODB_URI must point to a local MongoDB instance');
}
if (!databaseUrl.searchParams.get('replicaSet')) {
  throw new Error('Refusing to run: MONGODB_URI must specify a replica set for transaction checks');
}

const sourceDatabase = databaseUrl.pathname.replace(/^\//, '');
if (!sourceDatabase || sourceDatabase.includes('verify-')) {
  throw new Error('Refusing to derive an isolated test database from this URI');
}

const runId = randomUUID().replaceAll('-', '');
const testDatabase = `etm_verify_${runId}`;
databaseUrl.pathname = `/${testDatabase}`;
const testUri = databaseUrl.toString();
const port = Number(process.env.TEST_API_PORT) || 54000 + (process.pid % 10000);
const baseUrl = `http://127.0.0.1:${port}/api`;
const employeeIds = [];
const taskIds = [];
let child;
let serverOutput = '';
let testDatabaseInitialized = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(port, '127.0.0.1', () => {
      listener.close((error) => error ? reject(error) : resolve());
    });
  });
}

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
}

async function expectStatus(route, expectedStatus, options, label) {
  const result = await request(route, options);
  assert(
    result.response.status === expectedStatus,
    `${label}: expected HTTP ${expectedStatus}, got ${result.response.status}`
  );
  return result;
}

async function createEmployee(overrides = {}) {
  const sequence = employeeIds.length + 1;
  const employee = {
    employeeId: `VERIFY-${runId}-${sequence}`,
    fullName: `Verifier Employee ${sequence}`,
    email: `verify.${runId}.${sequence}@example.test`,
    phone: '+91 98765-43210',
    department: 'Development',
    role: 'QA Engineer',
    joiningDate: '2024-01-01',
    status: 'Active',
    ...overrides,
  };
  const result = await expectStatus('/employees', 201, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(employee),
  }, 'Create employee');
  assert(result.body.success && result.body.data?._id, 'Create employee response lacked an employee');
  employeeIds.push(result.body.data._id);
  return result.body.data;
}

async function createTask(employee, overrides = {}) {
  const task = {
    title: `Verify task ${runId} ${taskIds.length + 1}`,
    description: 'Temporary task created by the business-rule verifier.',
    assignedEmployee: employee._id,
    department: employee.department,
    priority: 'Medium',
    startDate: localDateOffset(0),
    dueDate: localDateOffset(2),
    ...overrides,
  };
  const result = await request('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (result.response.status === 201 && result.body?.data?._id) taskIds.push(result.body.data._id);
  return result;
}

function localDateOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function createIndexReadyDatabase() {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
  const Employee = require('../src/models/Employee');
  const Task = require('../src/models/Task');
  await Promise.all([Employee.init(), Task.init()]);
  testDatabaseInitialized = true;
  await mongoose.disconnect();
}

async function startApi() {
  await reservePort();
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: serverDirectory,
    env: { ...process.env, PORT: String(port), MONGODB_URI: testUri },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Backend exited during startup (code ${child.exitCode})`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.status === 200) return;
    } catch {
      // Continue polling while Express and MongoDB start.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Backend did not become healthy against the isolated database');
}

async function verifyEmployeeRules() {
  const employee = await createEmployee({ email: `  VERIFY.${runId}@EXAMPLE.TEST  ` });
  assert(employee.email === `verify.${runId}@example.test`, 'Employee email was not trimmed and lowercased');
  pass('employee creation and normalized email');

  const duplicateId = await expectStatus('/employees', 409, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      employeeId: employee.employeeId,
      fullName: 'Duplicate ID',
      email: `unique.id.${runId}@example.test`,
      phone: '9876543210',
      department: 'Development', role: 'QA Engineer', joiningDate: '2024-01-01', status: 'Active',
    }),
  }, 'Duplicate Employee ID');
  assert(duplicateId.body.success === false, 'Duplicate Employee ID response was not an error envelope');

  const duplicateEmail = await expectStatus('/employees', 409, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      employeeId: `VERIFY-DUP-${runId}`,
      fullName: 'Duplicate email',
      email: employee.email,
      phone: '9876543210',
      department: 'Development', role: 'QA Engineer', joiningDate: '2024-01-01', status: 'Active',
    }),
  }, 'Duplicate employee email');
  assert(duplicateEmail.body.success === false, 'Duplicate email response was not an error envelope');
  pass('duplicate Employee ID and email return HTTP 409');

  const deletionGuardEmployee = await createEmployee();
  const activeTask = await createTask(deletionGuardEmployee);
  assert(activeTask.response.status === 201, 'Could not create active task for deletion-guard check');
  const blockedDelete = await expectStatus(`/employees/${deletionGuardEmployee._id}`, 400, { method: 'DELETE' }, 'Delete employee with active task');
  assert(blockedDelete.body.success === false, 'Blocked deletion did not return an error envelope');
  const retained = await expectStatus(`/employees/${deletionGuardEmployee._id}`, 200, undefined, 'Verify employee remains after blocked deletion');
  assert(retained.body.data?._id === deletionGuardEmployee._id, 'Blocked deletion removed the employee');
  const inProgressTask = await createTask(deletionGuardEmployee);
  assert(inProgressTask.response.status === 201, 'Could not create In Progress deletion-guard task');
  await expectStatus(`/tasks/${inProgressTask.body.data._id}/status`, 200, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'In Progress' }),
  }, 'Move deletion-guard task to In Progress');
  await expectStatus(`/employees/${deletionGuardEmployee._id}`, 400, { method: 'DELETE' }, 'Delete employee with In Progress task');
  pass('employee deletion is rejected with both Todo and In Progress tasks');
}

async function verifyAssignmentRules() {
  const inactive = await createEmployee({ status: 'Inactive' });
  const inactiveTask = await createTask(inactive);
  assert(inactiveTask.response.status === 400, `Inactive assignment returned ${inactiveTask.response.status}`);

  const leaveStart = localDateOffset(10);
  const leaveEnd = localDateOffset(12);
  const onLeave = await createEmployee({ status: 'On Leave', leaveStart, leaveEnd });
  for (const boundary of [leaveStart, leaveEnd]) {
    const inside = await createTask(onLeave, { startDate: boundary, dueDate: boundary });
    assert(inside.response.status === 400, `On-leave assignment at inclusive boundary ${boundary} returned ${inside.response.status}`);
  }
  const before = await createTask(onLeave, { startDate: localDateOffset(9), dueDate: localDateOffset(9) });
  const after = await createTask(onLeave, { startDate: localDateOffset(13), dueDate: localDateOffset(13) });
  assert(before.response.status === 201, `On-leave assignment before interval returned ${before.response.status}`);
  assert(after.response.status === 201, `On-leave assignment after interval returned ${after.response.status}`);
  pass('Inactive rejection and inclusive On Leave boundaries/outside dates');

  const capacityEmployee = await createEmployee();
  const spoofedTask = await createTask(capacityEmployee, {
    taskId: 'CLIENT-SUPPLIED-TASK-ID',
    status: 'Completed',
    completedAt: '2000-01-01T00:00:00.000Z',
  });
  assert(spoofedTask.response.status === 400, 'Task creation accepted client-controlled task fields');
  const capacityTasks = [];
  for (let index = 0; index < 3; index += 1) {
    const task = await createTask(capacityEmployee);
    assert(task.response.status === 201, `Active task ${index + 1} was rejected`);
    capacityTasks.push(task.body.data);
  }
  assert(/^TASK-/.test(capacityTasks[0].taskId), 'Task ID was not generated by the backend');
  assert(capacityTasks.every((task) => task.status === 'Todo'), 'New task did not start in Todo status');
  assert(new Set(capacityTasks.map((task) => task.taskId)).size === capacityTasks.length, 'Generated Task IDs were not unique');
  const fourth = await createTask(capacityEmployee);
  assert(fourth.response.status === 400, `Fourth active task returned ${fourth.response.status}`);
  const invalidDates = await createTask(capacityEmployee, {
    title: `Invalid dates ${runId}`,
    startDate: localDateOffset(3),
    dueDate: localDateOffset(2),
  });
  assert(invalidDates.response.status === 400, `Task with due date before start date returned ${invalidDates.response.status}`);

  await expectStatus(`/tasks/${capacityTasks[1]._id}/status`, 200, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'In Progress' }),
  }, 'Move task to In Progress');
  const completed = await expectStatus(`/tasks/${capacityTasks[1]._id}/status`, 200, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }),
  }, 'Complete task');
  assert(completed.body.data?.completedAt, 'Completed task has no backend-generated completedAt');

  await expectStatus(`/tasks/${capacityTasks[2]._id}/status`, 200, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Cancelled' }),
  }, 'Cancel task');
  const afterTerminalTasks = await createTask(capacityEmployee);
  assert(afterTerminalTasks.response.status === 201, 'Completed/Cancelled tasks still counted against active capacity');
  pass('three-active-task limit and exclusion of Completed/Cancelled tasks');

  const raceEmployee = await createEmployee();
  assert((await createTask(raceEmployee)).response.status === 201, 'Could not seed race task 1');
  assert((await createTask(raceEmployee)).response.status === 201, 'Could not seed race task 2');
  const simultaneous = await Promise.all([
    createTask(raceEmployee, { title: `Concurrent A ${runId}` }),
    createTask(raceEmployee, { title: `Concurrent B ${runId}` }),
  ]);
  const statuses = simultaneous.map(({ response }) => response.status).sort((a, b) => a - b);
  assert(statuses[0] === 201 && statuses[1] === 400, `Expected one 201 and one 400 in race, got ${statuses.join(', ')}`);
  const raceList = await request(`/tasks?search=${encodeURIComponent(`Concurrent A ${runId}`)}&limit=100`);
  const allRaceTasks = await request(`/tasks?search=${encodeURIComponent(runId)}&limit=100`);
  assert(allRaceTasks.response.status === 200, 'Could not list race fixtures');
  const responseShape = Array.isArray(allRaceTasks.body)
    ? `top-level array of ${allRaceTasks.body.length}`
    : typeof allRaceTasks.body === 'string'
      ? `text response: ${allRaceTasks.body.slice(0, 120)}`
      : `object keys: ${Object.keys(allRaceTasks.body || {}).join(', ')}`;
  assert(Array.isArray(allRaceTasks.body?.data), `Task list response lacked a data array (${responseShape}; content-type ${allRaceTasks.response.headers.get('content-type')})`);
  const raceEmployeeTasks = allRaceTasks.body.data.filter((task) => task.assignedEmployee?._id === raceEmployee._id);
  assert(raceEmployeeTasks.length === 3, `Race employee has ${raceEmployeeTasks.length} active tasks, expected exactly 3`);
  assert(raceList.response.status === 200, 'Concurrent title search failed');
  pass('two simultaneous assignments at capacity produce exactly one success and never a fourth task');
}

async function verifyStatusAndOverdue() {
  const employee = await createEmployee();
  const transitionTask = await createTask(employee);
  assert(transitionTask.response.status === 201, 'Could not create status-transition task');
  const taskId = transitionTask.body.data._id;

  const invalidTodo = await expectStatus(`/tasks/${taskId}/status`, 400, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }),
  }, 'Reject Todo directly to Completed');
  assert(invalidTodo.body.success === false, 'Invalid transition did not return an error envelope');
  const toProgress = await expectStatus(`/tasks/${taskId}/status`, 200, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'In Progress' }),
  }, 'Todo to In Progress');
  assert(toProgress.body.data.status === 'In Progress', 'Valid status transition was not applied');

  const clientDateAttempt = await expectStatus(`/tasks/${taskId}/status`, 400, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'Completed', completedAt: '2000-01-01T00:00:00.000Z' }),
  }, 'Reject client completion date');
  assert(clientDateAttempt.body.success === false, 'Client-supplied completedAt was accepted');
  const beforeComplete = Date.now();
  const completed = await expectStatus(`/tasks/${taskId}/status`, 200, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }),
  }, 'In Progress to Completed');
  const completedAt = new Date(completed.body.data.completedAt).getTime();
  assert(Number.isFinite(completedAt) && completedAt >= beforeComplete - 2000 && completedAt <= Date.now() + 2000, 'completedAt was not generated near backend request time');
  const editCompleted = await expectStatus(`/tasks/${taskId}`, 400, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Should not edit' }),
  }, 'Reject edit to Completed task');
  assert(editCompleted.body.success === false, 'Completed task edit was accepted');
  const transitionCompleted = await expectStatus(`/tasks/${taskId}/status`, 400, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Todo' }),
  }, 'Reject transition from Completed');
  assert(transitionCompleted.body.success === false, 'Completed task status transition was accepted');

  const cancelTask = await createTask(employee);
  assert(cancelTask.response.status === 201, 'Could not create cancellation task');
  const cancelled = await expectStatus(`/tasks/${cancelTask.body.data._id}/status`, 200, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Cancelled' }),
  }, 'Todo to Cancelled');
  assert(!cancelled.body.data.completedAt, 'Cancelled task unexpectedly has completedAt');
  const editCancelled = await expectStatus(`/tasks/${cancelTask.body.data._id}`, 400, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Should not edit' }),
  }, 'Reject edit to Cancelled task');
  assert(editCancelled.body.success === false, 'Cancelled task edit was accepted');
  const transitionCancelled = await expectStatus(`/tasks/${cancelTask.body.data._id}/status`, 400, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Todo' }),
  }, 'Reject transition from Cancelled');
  assert(transitionCancelled.body.success === false, 'Cancelled task status transition was accepted');
  pass('valid/invalid transitions, server completion timestamp, and terminal edit restrictions');

  const todayEmployee = await createEmployee();
  const yesterdayEmployee = await createEmployee();
  const completedEmployee = await createEmployee();
  const cancelledEmployee = await createEmployee();
  const today = localDateOffset(0);
  const yesterday = localDateOffset(-1);
  const todayTask = await createTask(todayEmployee, { title: `Overdue today ${runId}`, startDate: today, dueDate: today });
  const yesterdayTask = await createTask(yesterdayEmployee, { title: `Overdue yesterday ${runId}`, startDate: yesterday, dueDate: yesterday });
  const completedOverdueTask = await createTask(completedEmployee, { title: `Completed overdue ${runId}`, startDate: yesterday, dueDate: yesterday });
  const cancelledOverdueTask = await createTask(cancelledEmployee, { title: `Cancelled overdue ${runId}`, startDate: yesterday, dueDate: yesterday });
  for (const fixture of [todayTask, yesterdayTask, completedOverdueTask, cancelledOverdueTask]) {
    assert(fixture.response.status === 201, 'Could not create overdue fixture');
  }
  for (const [fixture, status] of [[completedOverdueTask, 'Completed'], [cancelledOverdueTask, 'Cancelled']]) {
    if (status === 'Completed') {
      await expectStatus(`/tasks/${fixture.body.data._id}/status`, 200, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'In Progress' }),
      }, 'Prepare Completed overdue fixture');
    }
    await expectStatus(`/tasks/${fixture.body.data._id}/status`, 200, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
    }, `Set ${status} overdue fixture`);
  }
  const overdueList = await request(`/tasks?search=${encodeURIComponent(runId)}&limit=100`);
  assert(overdueList.response.status === 200, 'Could not list overdue fixtures');
  const overdueByTitle = new Map(overdueList.body.data.map((task) => [task.title, task.isOverdue]));
  assert(overdueByTitle.get(`Overdue today ${runId}`) === false, 'Due-today task was marked overdue');
  assert(overdueByTitle.get(`Overdue yesterday ${runId}`) === true, 'Due-yesterday active task was not marked overdue');
  assert(overdueByTitle.get(`Completed overdue ${runId}`) === false, 'Completed task was marked overdue');
  assert(overdueByTitle.get(`Cancelled overdue ${runId}`) === false, 'Cancelled task was marked overdue');
  const dashboard = await request('/dashboard');
  assert(dashboard.response.status === 200, 'Dashboard request failed');
  assert(dashboard.body.data?.tasks?.overdue === 1, `Dashboard overdue count was ${dashboard.body.data?.tasks?.overdue}, expected 1`);
  assert(dashboard.body.data.employeeWorkload.some((item) => item.tasks.totalActive === 0), 'Dashboard omitted employees with zero active tasks');
  pass('task-list/dashboard overdue rules, date boundaries, and zero-task dashboard employees');
}

async function verifyHistoricalEmployeeSnapshot() {
  const employee = await createEmployee({
    employeeId: `VERIFY-HIST-${runId}`,
    fullName: `@Historical Employee ${runId}`,
  });
  const title = `CSV, "snapshot"\n${runId}`;
  const created = await createTask(employee, {
    title,
    description: `Description, with "quotes" and\nline break ${runId}`,
  });
  assert(created.response.status === 201, 'Could not create historical snapshot task');
  await expectStatus(`/tasks/${created.body.data._id}/status`, 200, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'In Progress' }),
  }, 'Prepare historical task');
  await expectStatus(`/tasks/${created.body.data._id}/status`, 200, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }),
  }, 'Complete historical task');

  const formulaCases = [
    { title: `=1+1 ${runId}`, description: 'Formula-like title' },
    { title: `+SUM(1,1) ${runId}`, description: 'Formula-like title' },
    { title: `-1+1 ${runId}`, description: 'Formula-like title' },
    { title: `@SUM(1) ${runId}`, description: 'Formula-like title' },
    { title: `Tab prefix ${runId}`, description: `\t=1+1 ${runId}` },
    { title: `Carriage return prefix ${runId}`, description: `\r=1+1 ${runId}` },
    { title: `Line feed prefix ${runId}`, description: `\n=1+1 ${runId}` },
    { title: `Whitespace and control prefix ${runId}`, description: ` \t=1+1 ${runId}` },
    { title: `Control prefix without formula ${runId}`, description: `\tordinary text ${runId}` },
  ];
  for (const [index, values] of formulaCases.entries()) {
    const formulaTask = await createTask(employee, values);
    assert(formulaTask.response.status === 201, `Could not create CSV formula fixture ${index + 1}`);
    await expectStatus(`/tasks/${formulaTask.body.data._id}/status`, 200, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'In Progress' }),
    }, `Prepare CSV formula fixture ${index + 1}`);
    await expectStatus(`/tasks/${formulaTask.body.data._id}/status`, 200, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }),
    }, `Complete CSV formula fixture ${index + 1}`);
  }

  await expectStatus(`/employees/${employee._id}`, 200, { method: 'DELETE' }, 'Delete employee with historical task');
  const listed = await request(`/tasks?search=${encodeURIComponent(runId)}&limit=100`);
  assert(listed.response.status === 200, 'Could not list historical task after employee deletion');
  const historical = listed.body.data.find((task) => task._id === created.body.data._id);
  assert(historical?.assignedEmployee?.fullName === employee.fullName, 'Historical employee full name was not preserved in task listing');
  assert(historical?.assignedEmployee?.employeeId === employee.employeeId, 'Historical Employee ID was not preserved in task listing');

  const exported = await fetch(`${baseUrl}/tasks/export?search=${encodeURIComponent(runId)}&sortBy=title&sortOrder=asc`);
  assert(exported.status === 200, `CSV export returned HTTP ${exported.status}`);
  assert((exported.headers.get('content-type') || '').includes('text/csv'), 'CSV export returned the wrong content type');
  assert((exported.headers.get('content-disposition') || '').includes('attachment;'), 'CSV response did not include an attachment filename');
  const csv = (await exported.text()).replace(/^\uFEFF/, '');
  assert(csv.includes('"Task ID","Title","Description","Employee Name"'), 'CSV headers were missing or malformed');
  assert(csv.includes('"\'@Historical Employee ' + runId + '"'), 'CSV employee name was not protected from formula interpretation');
  assert(csv.includes('"CSV, ""snapshot""\n' + runId + '"'), 'CSV title quotes/line breaks were not escaped correctly');
  assert(csv.includes('"Description, with ""quotes"" and\nline break ' + runId + '"'), 'CSV description quotes/line breaks were not escaped correctly');
  for (const formula of [`=1+1 ${runId}`, `+SUM(1,1) ${runId}`, `-1+1 ${runId}`, `@SUM(1) ${runId}`]) {
    assert(csv.includes(`"'${formula}"`), `CSV did not neutralize formula-like title ${formula}`);
  }
  for (const description of [
    `\t=1+1 ${runId}`,
    `\r=1+1 ${runId}`,
    `\n=1+1 ${runId}`,
    ` \t=1+1 ${runId}`,
    `\tordinary text ${runId}`,
  ]) {
    const escaped = description.replace(/"/g, '""');
    assert(csv.includes(`"'${escaped}"`), `CSV did not safely preserve/neutralize leading control text ${JSON.stringify(description)}`);
  }
  pass('historical employee snapshot, spreadsheet formula neutralization, and CSV quoting');
}

async function cleanup() {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  if (!testDatabaseInitialized) {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    console.log('Temporary database was not initialized; no test records were created.');
    return;
  }
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
  const Employee = require('../src/models/Employee');
  const Task = require('../src/models/Task');
  if (taskIds.length) await Task.deleteMany({ _id: { $in: taskIds } });
  if (employeeIds.length) await Employee.deleteMany({ _id: { $in: employeeIds } });
  await mongoose.disconnect();
}

async function main() {
  console.log(`Isolated database: ${testDatabase}`);
  await createIndexReadyDatabase();
  await startApi();
  pass('backend health check against isolated replica-set database');
  await verifyEmployeeRules();
  await verifyAssignmentRules();
  await verifyStatusAndOverdue();
  await verifyHistoricalEmployeeSnapshot();
}

main()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    if (serverOutput) console.error('Backend emitted output during the failed run; details withheld to avoid exposing configuration.');
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
      console.log(`Cleaned up ${taskIds.length} task and ${employeeIds.length} employee test records; database was not dropped.`);
    } catch (error) {
      console.error(`CLEANUP FAILURE: ${error.message}`);
      process.exitCode = 1;
    }
  });
