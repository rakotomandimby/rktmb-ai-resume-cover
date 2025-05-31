import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemInstructionCoverLetter, getSystemInstructionCV } from './system-instruction';
import { getPromptCoverLetter, getPromptCV } from './prompt';
import { nl2br, getAPIKey, removeMarkdownCodeBlocks } from './utils';

export async function getGeminiCoverLetterResult(company: string, position: string, job: string, language: string, words: string, searchCompanyInfo: boolean): Promise<string> {
  const genAI = new GoogleGenerativeAI(getAPIKey("gemini"));
  const model = genAI.getGenerativeModel({
    model : "gemini-2.5-pro-preview-05-06",
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
    model: "gemini-2.5-pro-preview-05-06",
    systemInstruction: getSystemInstructionCV(jobDescription, language)
  });
  const prompt = getPromptCV(language, jobDescription, position);
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  return removeMarkdownCodeBlocks(text);
}

