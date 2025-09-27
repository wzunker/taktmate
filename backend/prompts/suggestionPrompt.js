/**
 * Suggestion prompt for generating starter questions
 * Used when creating new conversations to help users discover relevant questions
 */

/**
 * Multi-file suggestion prompt for generating starter questions
 * Used when creating conversations with multiple files
 */
function multiFileSuggestionPrompt(filesData) {
  if (!Array.isArray(filesData) || filesData.length === 0) {
    throw new Error('filesData must be a non-empty array');
  }

  // Create file summaries for the prompt
  const fileSummaries = filesData.map((file, index) => {
    let contentPreview = '';
    let contextualHints = '';

    switch (file.type.toLowerCase()) {
      case 'csv':
        const lines = file.content.split('\n');
        const headers = lines[0] || '';
        const sampleRows = lines.slice(1, 3).join('\n'); // First 2 data rows
        contentPreview = `Headers: ${headers}\nSample data:\n${sampleRows}`;
        contextualHints = 'data analysis, statistics, column values';
        break;
        
      case 'pdf':
      case 'docx':
        contentPreview = file.content.substring(0, 300) + (file.content.length > 300 ? '...' : '');
        contextualHints = 'document content, key findings, main topics';
        break;
        
      case 'xlsx':
        contentPreview = file.content.substring(0, 250) + (file.content.length > 250 ? '...' : '');
        contextualHints = 'spreadsheet data, calculations, worksheet content';
        break;
        
      case 'txt':
        contentPreview = file.content.substring(0, 250) + (file.content.length > 250 ? '...' : '');
        contextualHints = 'text content, themes, information extraction';
        break;
        
      default:
        contentPreview = file.content.substring(0, 250) + (file.content.length > 250 ? '...' : '');
        contextualHints = 'general content analysis, information extraction';
    }

    return {
      fileName: file.fileName,
      type: file.type,
      preview: contentPreview,
      hints: contextualHints
    };
  });

  const fileList = fileSummaries.map(f => `- ${f.fileName} (${f.type})`).join('\n');
  const contentPreviews = fileSummaries.map(f => 
    `=== ${f.fileName} ===\n${f.preview}`
  ).join('\n\n');

  return `You are a data analysis assistant. A user has uploaded ${filesData.length} files for analysis:

${fileList}

Here are previews of the content:

${contentPreviews}

Generate exactly 2 questions the user might want to ask about these files:
1. A cross-file analysis question that demonstrates how you can work across multiple documents
2. A specific question about insights that can be gained by combining or comparing the data

Requirements:
- Questions should leverage the multi-file context (comparing, combining, or cross-referencing data)
- Make questions specific to the actual content shown in the previews
- Focus on insights that are only possible with multiple files
- Avoid questions that assume data not visible in the previews
- Keep questions concise and actionable

Return your response in this exact JSON format:
{
  "suggestions": [
    "First cross-file analysis question here",
    "Second specific multi-file insight question here"
  ]
}`;
}

module.exports.suggestionPrompt = (fileName, fileType, fileContent) => {
  // Extract relevant preview data based on file type
  let contentPreview = '';
  let contextualHints = '';

  switch (fileType.toLowerCase()) {
    case 'csv':
      // For CSV files, extract headers and sample data
      const lines = fileContent.split('\n');
      const headers = lines[0] || '';
      const sampleRows = lines.slice(1, 4).join('\n'); // First 3 data rows
      contentPreview = `Headers: ${headers}\nSample data:\n${sampleRows}`;
      contextualHints = 'Focus on data analysis, statistics, and specific column values.';
      break;
      
    case 'pdf':
    case 'docx':
      // For documents, use first 500 characters
      contentPreview = fileContent.substring(0, 500) + (fileContent.length > 500 ? '...' : '');
      contextualHints = 'Focus on document content, key findings, and main topics.';
      break;
      
    case 'xlsx':
      // For Excel files, show sheet structure
      contentPreview = fileContent.substring(0, 400) + (fileContent.length > 400 ? '...' : '');
      contextualHints = 'Focus on spreadsheet data, calculations, and worksheet content.';
      break;
      
    case 'txt':
      // For text files, use first 400 characters
      contentPreview = fileContent.substring(0, 400) + (fileContent.length > 400 ? '...' : '');
      contextualHints = 'Focus on text content, themes, and information extraction.';
      break;
      
    default:
      contentPreview = fileContent.substring(0, 400) + (fileContent.length > 400 ? '...' : '');
      contextualHints = 'Focus on general content analysis and information extraction.';
  }

  return `You are a data analysis assistant. A user has uploaded a file named "${fileName}" of type ${fileType}.

Here is a preview of the content:
${contentPreview}

${contextualHints}

Generate exactly 2 questions the user might want to ask about this data:
1. An exploratory, open-ended question that helps users understand the overall content or structure
2. A specific, actionable question that demonstrates concrete analysis capabilities

Requirements:
- Questions should be directly relevant to the actual content shown
- Make questions specific enough to be useful but general enough to work with the data
- Avoid questions that assume data not visible in the preview
- Keep questions concise and clear

Return your response in this exact JSON format:
{
  "suggestions": [
    "First exploratory question here",
    "Second specific question here"
  ]
}`;
};

module.exports.multiFileSuggestionPrompt = multiFileSuggestionPrompt;
