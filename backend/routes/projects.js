/**
 * Project Management Routes
 * 
 * RESTful API endpoints for project organization:
 * - Create new projects
 * - List user projects
 * - Get project details
 * - Update project (rename)
 * - Delete project and associated data
 * - Get project files and conversations
 * 
 * All endpoints require authentication via Azure Static Web Apps
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const cosmosService = require('../services/cosmos');
const { listUserFiles, deleteBlob } = require('../services/storage');

const router = express.Router();

// Apply authentication to all project routes
router.use(requireAuth);

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required and must be a non-empty string'
      });
    }

    // Validate name length and characters
    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Project name must be 100 characters or less'
      });
    }

    // Check for duplicate project names for this user
    const existingProjects = await cosmosService.listUserProjects(userId);
    const duplicateName = existingProjects.some(project => 
      project.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicateName) {
      return res.status(409).json({
        success: false,
        error: 'A project with this name already exists'
      });
    }

    const project = await cosmosService.createProject(userId, trimmedName, description);

    res.status(201).json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project'
    });
  }
});

/**
 * GET /api/projects
 * List all user projects
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const projects = await cosmosService.listUserProjects(userId, limit, offset);

    res.json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list projects'
    });
  }
});

/**
 * GET /api/projects/:id
 * Get specific project details
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    const project = await cosmosService.getProject(projectId, userId);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    res.json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Error getting project:', error);
    if (error.message === 'Project not found') {
      res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to get project'
      });
    }
  }
});

/**
 * PUT /api/projects/:id
 * Update project (rename)
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required and must be a non-empty string'
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Project name must be 100 characters or less'
      });
    }

    // Check for duplicate project names for this user (excluding current project)
    const existingProjects = await cosmosService.listUserProjects(userId);
    const duplicateName = existingProjects.some(project => 
      project.id !== projectId && project.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicateName) {
      return res.status(409).json({
        success: false,
        error: 'A project with this name already exists'
      });
    }

    const updatedProject = await cosmosService.updateProject(projectId, userId, { name: trimmedName });

    res.json({
      success: true,
      project: updatedProject
    });
  } catch (error) {
    console.error('Error updating project:', error);
    if (error.message === 'Project not found') {
      res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update project'
      });
    }
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project and associated data
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    // Get project to ensure it exists and belongs to user
    const project = await cosmosService.getProject(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Get project files for cleanup
    const projectFiles = await cosmosService.getProjectFiles(projectId, userId);
    
    // Get project conversations for cleanup
    const projectConversations = await cosmosService.getProjectConversations(projectId, userId);

    // Delete project files from blob storage
    for (const file of projectFiles) {
      try {
        await deleteBlob(userId, `projects/${projectId}/files/${file.name}`);
      } catch (fileError) {
        console.warn(`Failed to delete file ${file.name} from blob storage:`, fileError.message);
        // Continue with deletion even if some files fail
      }
    }

    // Delete project conversations
    for (const conversation of projectConversations) {
      try {
        await cosmosService.deleteConversation(conversation.id, userId);
      } catch (convError) {
        console.warn(`Failed to delete conversation ${conversation.id}:`, convError.message);
        // Continue with deletion even if some conversations fail
      }
    }

    // Delete the project itself
    await cosmosService.deleteProject(projectId, userId);

    res.json({
      success: true,
      message: 'Project and associated data deleted successfully',
      deletedFiles: projectFiles.length,
      deletedConversations: projectConversations.length
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    if (error.message === 'Project not found') {
      res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete project'
      });
    }
  }
});

/**
 * GET /api/projects/:id/files
 * Get files in project
 */
router.get('/:id/files', async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    // Verify project exists and belongs to user
    const project = await cosmosService.getProject(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const files = await cosmosService.getProjectFiles(projectId, userId);

    res.json({
      success: true,
      files
    });
  } catch (error) {
    console.error('Error getting project files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get project files'
    });
  }
});

/**
 * GET /api/projects/:id/conversations
 * Get project conversations
 */
router.get('/:id/conversations', async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Verify project exists and belongs to user
    const project = await cosmosService.getProject(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const conversations = await cosmosService.getProjectConversations(projectId, userId, limit, offset);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Error getting project conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get project conversations'
    });
  }
});

module.exports = router;
