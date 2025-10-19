# Use paralelize requesting to the APIs 

With the current code, the requests to the APIs are made sequentially.
And they are slow. There are 2 requests to the OpenAI API and 2 requests to the Google AI API.

I want to paralelize the requests to the APIs, and adapt the EJS templates accordingly.
We must maintain the token verification before making the requests to the APIs.

Tell me the full new content of the files I need to modify to implement this feature.


# ANT Parallelize API Requests for Improved Performance

I implement parallel API requests to both OpenAI and Google AI APIs to significantly reduce the overall processing time. Instead of making four sequential requests, the application will now make all four requests concurrently using `Promise.all()`. The token verification remains in place before any API calls are made, ensuring security is maintained.

## Implementation Overview

The main change occurs in the POST handler in `./src/index.ts`. After token validation, I use `Promise.all()` to execute all four API calls simultaneously. Each promise is wrapped in a try-catch block to handle individual failures gracefully, so if one API call fails, the others can still complete successfully.

The EJS template remains unchanged since it already displays results from all four API calls, and the rendering logic stays the same - we just populate the results faster.

## Files Modified

1. `./src/index.ts` - Modified POST handler to use parallel requests

---

## File: ./src/index.ts

```typescript
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

  // Initialize results object
  const results = {
    geminiCV: "Processing...",
    openAICV: "Processing...",
    geminiCoverLetter: "Processing...",
    openAICoverLetter: "Processing..."
  };

  // Create promises for all four API calls with individual error handling
  const geminiCVPromise = getGeminiCVResult(job, position, language)
    .then(result => {
      results.geminiCV = result;
    })
    .catch(error => {
      console.error("Error with Gemini CV generation:", error);
      results.geminiCV = `<div class="alert alert-danger">Error generating CV with Gemini: ${error instanceof Error ? error.message : 'Unknown error occurred'}</div>`;
    });

  const openAICVPromise = getOpenAICVResult(job, position, language)
    .then(result => {
      results.openAICV = result;
    })
    .catch(error => {
      console.error("Error with OpenAI CV generation:", error);
      results.openAICV = `<div class="alert alert-danger">Error generating CV with OpenAI: ${error instanceof Error ? error.message : 'Unknown error occurred'}</div>`;
    });

  const geminiCoverLetterPromise = getGeminiCoverLetterResult(companyForProcessing, position, job, language, words, searchCompanyInfo)
    .then(result => {
      results.geminiCoverLetter = result;
    })
    .catch(error => {
      console.error("Error with Gemini Cover Letter generation:", error);
      results.geminiCoverLetter = `Error generating Cover Letter with Gemini: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    });

  const openAICoverLetterPromise = getOpenAICoverLetterResult(companyForProcessing, position, job, language, words, searchCompanyInfo)
    .then(result => {
      results.openAICoverLetter = result;
    })
    .catch(error => {
      console.error("Error with OpenAI Cover Letter generation:", error);
      results.openAICoverLetter = `Error generating Cover Letter with OpenAI: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    });

  // Wait for all promises to complete (either resolve or reject)
  await Promise.all([
    geminiCVPromise,
    openAICVPromise,
    geminiCoverLetterPromise,
    openAICoverLetterPromise
  ]);

  // Render the results after all API calls have completed
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
```

## Explanation

The key changes in the POST handler are:

1. **Token verification first**: All validation (including token verification) happens before any API calls are initiated, maintaining security.

2. **Parallel API calls**: I create four separate promises, one for each API call:
   - `geminiCVPromise`
   - `openAICVPromise`
   - `geminiCoverLetterPromise`
   - `openAICoverLetterPromise`

3. **Individual error handling**: Each promise has its own `.then()` and `.catch()` handlers, ensuring that if one API call fails, it doesn't prevent the others from completing successfully.

4. **Wait for all**: `Promise.all()` waits for all four promises to settle (either resolve or reject) before proceeding to render the results.

5. **Result aggregation**: The `results` object is populated by each promise's `.then()` handler, and error messages are set in the `.catch()` handlers.

This approach reduces the total processing time from the sum of all four API calls to approximately the time of the slowest single API call, providing a significant performance improvement for the user.

Anthropic claude-sonnet-4-5-20250929 (9.18k in, 2.93k out)


