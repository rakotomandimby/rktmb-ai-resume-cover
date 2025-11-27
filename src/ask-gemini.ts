import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemInstructionCoverLetter, getSystemInstructionCV } from './system-instruction';
import { getPromptCoverLetter, getPromptCV } from './prompt';
import { nl2br, getAPIKey, removeMarkdownCodeBlocks } from './utils';

const model_to_use = 'gemini-3-pro-preview';

export async function getGeminiCoverLetterResult(company: string, position: string, job: string, language: string, words: string, searchCompanyInfo: boolean): Promise<string> {
  const genAI = new GoogleGenerativeAI(getAPIKey("gemini"));
  const model = genAI.getGenerativeModel({
    model : model_to_use, 
    systemInstruction: getSystemInstructionCoverLetter(company, job, words, language, searchCompanyInfo)
  });
  const prompt = getPromptCoverLetter(language, company, position, words);
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  return nl2br(text);
}

export async function getGeminiCVResult(jobDescription: string, position: string, language: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(getAPIKey("gemini"));
  const model = genAI.getGenerativeModel({
    model: model_to_use,
    systemInstruction: getSystemInstructionCV(jobDescription, language)
  });
  const prompt = getPromptCV(language, jobDescription, position);
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  return removeMarkdownCodeBlocks(text);
}

