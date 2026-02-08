const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/Auth');
const { createCategory, getCategories, updateCategory, deleteCategory } = require('../controllers/categoryController');

// All routes require authentication
router.use(isAuthenticated);

// Create a category
router.post('/:serverId', createCategory);

// Get categories for a server
router.get('/:serverId', getCategories);

// Update a category (name)
router.patch('/:categoryId', updateCategory);

// Delete a category
router.delete('/:categoryId', deleteCategory);

module.exports = router;
