import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes a message for toxicity and provides a moderation recommendation.
 */
export const analyzeMessageSafety = async (message: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        You are a content moderator for a college anonymous posting app. 
        Analyze the following message for bullying, hate speech, severe toxicity, or self-harm.
        
        Message: "${message}"
        
        Return a short JSON object with two keys:
        1. "safe": boolean
        2. "reason": short string explanation (max 10 words).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            safe: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          },
        },
      }
    });
    
    const text = response.text;
    if (!text) return "Could not analyze.";
    
    const result = JSON.parse(text);
    return result.safe ? "✅ Safe to post" : `⚠️ Caution: ${result.reason}`;

  } catch (error) {
    console.error("Gemini analysis failed", error);
    return "Analysis failed.";
  }
};

/**
 * Helps the user polish their anonymous message.
 */
export const polishMessage = async (message: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Reword the following casual message to be more clear and engaging, but keep the informal vibe.
      
      Message: "${message}"`,
    });
    return response.text || message;
  } catch (error) {
    console.error("Gemini polish failed", error);
    return message;
  }
};