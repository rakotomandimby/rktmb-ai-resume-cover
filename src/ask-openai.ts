import OpenAI from 'openai';
import { getPromptCoverLetter, getPromptCV } from './prompt';
import { getSystemInstructionCoverLetter, getSystemInstructionCV } from './system-instruction';
import { nl2br, nullToEmptyString, getAPIKey, removeMarkdownCodeBlocks } from './utils';

const model = 'gpt-4.5-preview'; 

export async function getOpenAICoverLetterResult(company: string, position: string, job: string, language: string, words: string, searchCompanyInfo: boolean ): Promise<string> {
  const openai = new OpenAI({apiKey: getAPIKey("openai")});
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {role: 'system', content: getSystemInstructionCoverLetter(company, job, words, language, searchCompanyInfo)}, // Pass searchCompanyInfo
      {role: 'user', content: getPromptCoverLetter(language, company, position, words)}
    ],
    model: model}); 
  return nl2br( nullToEmptyString(chatCompletion.choices[0].message.content));
}

export async function getOpenAICVResult(jobDescription: string, position: string, language: string): Promise<string> {
  const openai = new OpenAI({apiKey: getAPIKey("openai")});
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {role: 'system', content: getSystemInstructionCV(jobDescription, language)},
      {role: 'user', content: getPromptCV(language, jobDescription, position)}
    ],
    model: model}); // Consider using a more up-to-date model if available/preferred
  return removeMarkdownCodeBlocks(nullToEmptyString(chatCompletion.choices[0].message.content));
}

