import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import cookieParser from 'cookie-parser'; // Added
import csrf from 'csurf'; // Added
import { getOpenAICoverLetterResult, getOpenAICVResult } from './ask-openai';
import { getGeminiCoverLetterResult, getGeminiCVResult } from './ask-gemini';
import { getAuthToken } from './utils';

const app = express();
const port = process.env.PORT || 3000;

// --- Environment Variable Checks ---
const envErrors: string[] = [];

if (!process.env.OPENAI_API_KEY) {
  envErrors.push("OPENAI_API_KEY is not set. OpenAI features may not work.");
}
if (!process.env.GOOGLEAI_API_KEY) {
  envErrors.push("GOOGLEAI_API_KEY is not set. Google AI features may not work.");
}

const configuredAuthToken = getAuthToken();
if (!configuredAuthToken) {
  envErrors.push("AUTH_TOKEN is not set or is empty. The application is insecure, and submissions will be blocked.");
}
// --- End Environment Variable Checks ---

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser()); // Use cookie-parser middleware
const csrfProtection = csrf({ cookie: true }); // Setup csurf middleware

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static('public'));

// Define initial options for rendering the page, including a spot for form errors
const initialRenderOptions = {
  envErrors: envErrors,
  geminiCVResult: "Waiting for your job description for CV generation",
  openAICVResult: "Waiting for your job description for CV generation",
  geminiCoverLetterResult: "Waiting for your question for Cover Letter",
  openAICoverLetterResult: "Waiting for your question for Cover Letter",
  formError: null as string | null, // For displaying form-specific errors
};

app.get('/', csrfProtection, (req: Request, res: Response) => {
  res.render('index', {
    ...initialRenderOptions,
    csrfToken: (req as any).csrfToken() // Pass CSRF token to the template
  });
});

app.post('/', csrfProtection, async (req: Request, res: Response) => {
  const { job, language, position, words, token: submittedToken } = req.body;
  const companyFromRequest = req.body.company;
  const searchCompanyInfo = req.body.searchCompany === 'true';

  // Base options for re-rendering the form in case of errors in POST
  const baseRenderOptionsForPost = {
    envErrors: envErrors,
    geminiCVResult: "An error occurred or input was missing.",
    openAICVResult: "An error occurred or input was missing.",
    geminiCoverLetterResult: "An error occurred or input was missing.",
    openAICoverLetterResult: "An error occurred or input was missing.",
    csrfToken: (req as any).csrfToken(), // Crucial for re-rendering the form
    formError: null as string | null,
  };

  if (!job || !language || !position || !words || submittedToken === undefined) {
    return res.render('index', {
      ...baseRenderOptionsForPost,
      formError: "Missing required fields: job, language, position, words, or token.",
      geminiCVResult: "Missing required fields.",
      openAICVResult: "Missing required fields.",
      geminiCoverLetterResult: "Missing required fields.",
      openAICoverLetterResult: "Missing required fields."
    });
  }

  if (searchCompanyInfo && !companyFromRequest) {
    return res.render('index', {
      ...baseRenderOptionsForPost,
      formError: "Company name is required when 'Attempt to use specific information' is checked.",
      geminiCVResult: "Company name required.",
      openAICVResult: "Company name required.",
      geminiCoverLetterResult: "Company name required.",
      openAICoverLetterResult: "Company name required."
    });
  }

  let companyForProcessing: string;
  if (searchCompanyInfo) {
    companyForProcessing = companyFromRequest!;
  } else {
    companyForProcessing = 'Unknown';
  }

  if (!configuredAuthToken) {
    return res.render('index', {
      ...baseRenderOptionsForPost,
      formError: "Security Alert: Application AUTH_TOKEN is not configured. Submission rejected.",
      geminiCVResult: "AUTH_TOKEN not configured.",
      openAICVResult: "AUTH_TOKEN not configured.",
      geminiCoverLetterResult: "AUTH_TOKEN not configured.",
      openAICoverLetterResult: "AUTH_TOKEN not configured."
    });
  }

  if (submittedToken !== configuredAuthToken) {
    return res.render('index', {
      ...baseRenderOptionsForPost,
      formError: "Invalid token.",
      geminiCVResult: "Invalid token.",
      openAICVResult: "Invalid token.",
      geminiCoverLetterResult: "Invalid token.",
      openAICoverLetterResult: "Invalid token."
    });
  }

  // Individual error handling for each AI model
  const results = {
    geminiCV: "Processing...",
    openAICV: "Processing...",
    geminiCoverLetter: "Processing...",
    openAICoverLetter: "Processing..."
  };

  // Process Gemini CV with individual error handling
  try {
    results.geminiCV = await getGeminiCVResult(job, position, language);
  } catch (error) {
    console.error("Error with Gemini CV generation:", error);
    results.geminiCV = `<div class="alert alert-danger">Error generating CV with Gemini: ${error instanceof Error ? error.message : 'Unknown error occurred'}</div>`;
  }

  // Process OpenAI CV with individual error handling
  try {
    results.openAICV = await getOpenAICVResult(job, position, language);
  } catch (error) {
    console.error("Error with OpenAI CV generation:", error);
    results.openAICV = `<div class="alert alert-danger">Error generating CV with OpenAI: ${error instanceof Error ? error.message : 'Unknown error occurred'}</div>`;
  }

  // Process Gemini Cover Letter with individual error handling
  try {
    results.geminiCoverLetter = await getGeminiCoverLetterResult(companyForProcessing, position, job, language, words, searchCompanyInfo);
  } catch (error) {
    console.error("Error with Gemini Cover Letter generation:", error);
    results.geminiCoverLetter = `Error generating Cover Letter with Gemini: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
  }

  // Process OpenAI Cover Letter with individual error handling
  try {
    results.openAICoverLetter = await getOpenAICoverLetterResult(companyForProcessing, position, job, language, words, searchCompanyInfo);
  } catch (error) {
    console.error("Error with OpenAI Cover Letter generation:", error);
    results.openAICoverLetter = `Error generating Cover Letter with OpenAI: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
  }

  res.render('index', {
    envErrors: envErrors,
    geminiCVResult: results.geminiCV,
    openAICVResult: results.openAICV,
    geminiCoverLetterResult: results.geminiCoverLetter,
    openAICoverLetterResult: results.openAICoverLetter,
    csrfToken: (req as any).csrfToken(), // Pass token for the rendered page (though form is usually gone on success)
    formError: null,
  });
});

// CSRF error handler middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.warn('CSRF Token Validation Failed for request to:', req.path);
    // Render the page again with an error message and a new CSRF token
    res.status(403).render('index', {
      ...initialRenderOptions, // Use initial state for results display
      csrfToken: (req as any).csrfToken ? (req as any).csrfToken() : '', // Attempt to get a new token
      formError: 'Invalid form submission token. Please refresh the page and try again. Ensure cookies are enabled in your browser.'
    });
  } else {
    // For other errors, pass them to the default Express error handler or other error handlers
    next(err);
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  if (envErrors.length > 0) {
    console.warn("--- Configuration Issues Detected ---");
    envErrors.forEach(err => console.warn(`- ${err}`));
    console.warn("------------------------------------");
  }
});

