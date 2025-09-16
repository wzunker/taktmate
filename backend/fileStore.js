// In-memory storage for uploaded CSV files
class FileStore {
  constructor() {
    this.files = new Map();
  }

  // Store parsed CSV data
  store(fileId, filename, rows, userId = null) {
    this.files.set(fileId, {
      filename,
      rows,
      uploadedAt: new Date(),
      userId
    });
    return fileId;
  }

  // Retrieve CSV data by fileId
  get(fileId) {
    return this.files.get(fileId);
  }

  // Check if file exists
  exists(fileId) {
    return this.files.has(fileId);
  }

  // Get all file IDs (for debugging)
  getAllIds() {
    return Array.from(this.files.keys());
  }

  // Clear all files
  clear() {
    this.files.clear();
  }
}

module.exports = new FileStore();
