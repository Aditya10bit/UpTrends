// Simple test function to verify Gemini API integration
import { generateOutfitsFromPrompt } from '../services/geminiService';

export const testGeminiAPI = async () => {
  try {
    console.log('Testing Gemini API...');
    const result = await generateOutfitsFromPrompt('dinner at a fancy restaurant');
    console.log('Gemini API test successful:', result);
    return true;
  } catch (error) {
    console.error('Gemini API test failed:', error);
    return false;
  }
};