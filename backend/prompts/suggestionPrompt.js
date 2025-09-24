/**
 * Suggestion prompt for generating starter questions
 * Used when creating new conversations to help users discover relevant questions
 */

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
