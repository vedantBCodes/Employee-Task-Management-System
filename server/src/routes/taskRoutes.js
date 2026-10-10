const express = require('express');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.post('/', taskController.createTask);
router.get('/', taskController.listTasks);

module.exports = router;
