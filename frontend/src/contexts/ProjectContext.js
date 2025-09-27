import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../utils/auth';

const ProjectContext = createContext();

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export const ProjectProvider = ({ children }) => {
  // Core project state
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Project files and conversations
  const [projectFiles, setProjectFiles] = useState([]);
  const [projectConversations, setProjectConversations] = useState([]);
  
  // Loading states
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  
  // Error handling
  const [error, setError] = useState(null);
  
  // User preferences
  const [userPreferences, setUserPreferences] = useState(null);

  // Load user preferences and active project on mount
  useEffect(() => {
    loadUserPreferences();
  }, []);

  // Load project details when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      setSelectedProject(project);
      loadProjectFiles(selectedProjectId);
      loadProjectConversations(selectedProjectId);
    } else {
      setSelectedProject(null);
      setProjectFiles([]);
      setProjectConversations([]);
    }
  }, [selectedProjectId, projects]);

  // Load all projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadUserPreferences = async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.get('/api/projects/preferences', {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        setUserPreferences(response.data.preferences);
        // Set active project from preferences
        if (response.data.preferences.activeProjectId) {
          setSelectedProjectId(response.data.preferences.activeProjectId);
        }
      }
    } catch (error) {
      console.warn('User preferences API not available, using localStorage fallback:', error.message);
      // Gracefully handle missing endpoint - use localStorage fallback
      const storedProjectId = localStorage.getItem('taktmate-active-project');
      if (storedProjectId) {
        setSelectedProjectId(storedProjectId);
      }
    }
  };

  const loadProjects = async () => {
    setProjectsLoading(true);
    setError(null);
    
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.get('/api/projects', {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        const loadedProjects = response.data.projects || [];
        setProjects(loadedProjects);
        
        // Clear invalid selectedProjectId if it doesn't exist in loaded projects
        if (selectedProjectId && !loadedProjects.find(p => p.id === selectedProjectId)) {
          console.warn(`Selected project ${selectedProjectId} not found in loaded projects, clearing selection`);
          setSelectedProjectId(null);
          localStorage.removeItem('taktmate-active-project');
        }
      } else {
        throw new Error(response.data.error || 'Failed to load projects');
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError('Failed to load projects. Please try again.');
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadProjectFiles = async (projectId) => {
    if (!projectId) return;
    
    setFilesLoading(true);
    
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.get(`/api/projects/${projectId}/files`, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        setProjectFiles(response.data.files || []);
      } else {
        throw new Error(response.data.error || 'Failed to load project files');
      }
    } catch (error) {
      console.error('Failed to load project files:', error);
      setProjectFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  const loadProjectConversations = async (projectId) => {
    if (!projectId) return;
    
    setConversationsLoading(true);
    
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.get(`/api/projects/${projectId}/conversations`, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        setProjectConversations(response.data.conversations || []);
      } else {
        throw new Error(response.data.error || 'Failed to load project conversations');
      }
    } catch (error) {
      console.error('Failed to load project conversations:', error);
      setProjectConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  };

  const createProject = async (name, description = '') => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.post('/api/projects', {
        name,
        description
      }, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        const newProject = response.data.project;
        setProjects(prev => [...prev, newProject]);
        
        // Auto-select the new project
        setSelectedProjectId(newProject.id);
        await setActiveProject(newProject.id);
        
        return newProject;
      } else {
        throw new Error(response.data.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  const updateProject = async (projectId, updates) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.put(`/api/projects/${projectId}`, updates, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        const updatedProject = response.data.project;
        setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
        
        // Update selected project if it's the one being updated
        if (selectedProjectId === projectId) {
          setSelectedProject(updatedProject);
        }
        
        return updatedProject;
      } else {
        throw new Error(response.data.error || 'Failed to update project');
      }
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  };

  const deleteProject = async (projectId) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.delete(`/api/projects/${projectId}`, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        
        // Clear selection if the deleted project was selected
        if (selectedProjectId === projectId) {
          setSelectedProjectId(null);
          await setActiveProject(null);
        }
        
        return true;
      } else {
        throw new Error(response.data.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  };

  const selectProject = async (projectId) => {
    setSelectedProjectId(projectId);
    if (projectId) {
      await setActiveProject(projectId);
    }
  };

  const setActiveProject = async (projectId) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.post(`/api/projects/${projectId}/activate`, {}, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        setUserPreferences(response.data.preferences);
        return response.data.preferences;
      } else {
        throw new Error(response.data.error || 'Failed to set active project');
      }
    } catch (error) {
      console.error('Failed to set active project:', error);
      // Fallback to localStorage if endpoint doesn't exist
      if (projectId) {
        localStorage.setItem('taktmate-active-project', projectId);
      } else {
        localStorage.removeItem('taktmate-active-project');
      }
    }
  };

  const uploadFile = async (file, projectId) => {
    if (!projectId) {
      throw new Error('Project ID is required for file upload');
    }

    try {
      const authHeaders = await getAuthHeaders();
      
      // Try project-based upload first, fallback to regular upload
      let sasResponse;
      try {
        sasResponse = await axios.post('/api/files/project-upload-sas', {
          fileName: file.name,
          contentType: file.type,
          projectId: projectId
        }, {
          headers: authHeaders,
          timeout: 10000
        });
      } catch (error) {
        console.warn('Project upload endpoint not available, using regular upload');
        // Fallback to regular file upload
        sasResponse = await axios.post('/api/files/upload-sas', {
          fileName: file.name,
          contentType: file.type
        }, {
          headers: authHeaders,
          timeout: 10000
        });
      }

      if (!sasResponse.data.success) {
        throw new Error(sasResponse.data.error || 'Failed to get upload token');
      }

      // Upload file to blob storage
      const uploadResponse = await fetch(sasResponse.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
          'x-ms-blob-type': 'BlockBlob'
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Refresh project files
      await loadProjectFiles(projectId);
      
      // Update project stats
      await loadProjects();

      return true;
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  };

  const deleteFile = async (fileName, projectId) => {
    if (!projectId) {
      throw new Error('Project ID is required for file deletion');
    }

    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.delete(`/api/files/project/${projectId}/${encodeURIComponent(fileName)}`, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        // Refresh project files
        await loadProjectFiles(projectId);
        
        // Update project stats
        await loadProjects();
        
        return true;
      } else {
        throw new Error(response.data.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  };

  const createConversation = async (projectId, fileIds, title = null) => {
    if (!projectId || !fileIds || fileIds.length === 0) {
      throw new Error('Project ID and file IDs are required for conversation creation');
    }

    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.post('/api/conversations', {
        projectId,
        fileIds,
        title
      }, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        const newConversation = response.data.conversation;
        
        // Refresh project conversations
        await loadProjectConversations(projectId);
        
        // Update project stats
        await loadProjects();
        
        return newConversation;
      } else {
        throw new Error(response.data.error || 'Failed to create conversation');
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  };

  const updateConversation = async (conversationId, updates) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.put(`/api/conversations/${conversationId}`, updates, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        // Refresh project conversations
        if (selectedProjectId) {
          await loadProjectConversations(selectedProjectId);
        }
        
        return response.data.conversation;
      } else {
        throw new Error(response.data.error || 'Failed to update conversation');
      }
    } catch (error) {
      console.error('Failed to update conversation:', error);
      throw error;
    }
  };

  const deleteConversation = async (conversationId) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await axios.delete(`/api/conversations/${conversationId}`, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success) {
        // Refresh project conversations
        if (selectedProjectId) {
          await loadProjectConversations(selectedProjectId);
        }
        
        // Update project stats
        await loadProjects();
        
        return true;
      } else {
        throw new Error(response.data.error || 'Failed to delete conversation');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  };

  const refreshProject = async (projectId = selectedProjectId) => {
    if (projectId) {
      await Promise.all([
        loadProjectFiles(projectId),
        loadProjectConversations(projectId)
      ]);
    }
    await loadProjects();
  };

  const clearError = () => {
    setError(null);
  };

  const contextValue = {
    // State
    projects,
    selectedProjectId,
    selectedProject,
    projectFiles,
    projectConversations,
    userPreferences,
    
    // Loading states
    projectsLoading,
    filesLoading,
    conversationsLoading,
    
    // Error state
    error,
    clearError,
    
    // Project actions
    createProject,
    updateProject,
    deleteProject,
    selectProject,
    setActiveProject,
    refreshProject,
    
    // File actions
    uploadFile,
    deleteFile,
    
    // Conversation actions
    createConversation,
    updateConversation,
    deleteConversation,
    
    // Refresh actions
    loadProjects,
    loadProjectFiles,
    loadProjectConversations
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};

export default ProjectContext;
