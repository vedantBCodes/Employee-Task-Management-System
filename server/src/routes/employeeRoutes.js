const express = require('express');
const employeeController = require('../controllers/employeeController');

const router = express.Router();

router.post('/', employeeController.createEmployee);
router.get('/', employeeController.listEmployees);
router.get('/:id', employeeController.getEmployee);
router.put('/:id', employeeController.updateEmployee);
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;
