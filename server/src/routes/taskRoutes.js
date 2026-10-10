const express = require('express');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.post('/', taskController.createTask);
router.get('/export', taskController.exportTasks);
router.get('/', taskController.listTasks);
router.put('/:id/status', taskController.updateTaskStatus);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
