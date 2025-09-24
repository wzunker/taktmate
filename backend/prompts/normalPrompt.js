/**
 * Normal conversation prompt for document analysis
 * Used for regular chat interactions with uploaded documents
 */

module.exports.normalPrompt = (fileContent, conversationMessages = []) => {
  let systemPrompt = `You are a helpful document analysis assistant.  
        Your role is to answer questions using only the provided document data.  

        Guidelines:
        - Use **only** the document data provided. If the answer is not present, reply exactly: "No relevant data found."  
        - Give the most accurate and complete answer possible while staying concise.  
        - Respond in a warm, professional tone (polite, clear, approachable).   
        - For lists, provide the relevant items in a clean format (bulleted list or comma-separated, depending on clarity).  
        - For numbers, include units if available.  
        - Do not over-explain your reasoning or add outside commentary unless the user explicitly asks for it.  

${fileContent}`;

  // Add conversation context if available
  if (conversationMessages.length > 0) {
    systemPrompt += `\n\nPrevious conversation context:\n`;
    conversationMessages.forEach(msg => {
      systemPrompt += `${msg.role}: ${msg.content}\n`;
    });
    systemPrompt += `\nContinue the conversation based on this context.`;
  }

  return systemPrompt;
};
