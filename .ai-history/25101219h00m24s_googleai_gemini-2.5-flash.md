# Use paralelize requesting to the APIs 

With the current code, the requests to the APIs are made sequentially.
And they are slow. There are 2 requests to the OpenAI API and 2 requests to the Google AI API.

I want to paralelize the requests to the APIs, and adapt the EJS templates accordingly.
We must maintain the token verification before making the requests to the APIs.

Tell me the full new content of the files I need to modify to implement this feature.


# GGL Parallelize API Requests for Faster Document Generation

I will modify the `./src/index.ts` file to parallelize the API requests to OpenAI and Google AI for both CV and Cover Letter generation. This will significantly speed up the document generation process by allowing all four API calls to run concurrently. I will use `Promise.allSettled` to handle potential individual API errors gracefully, ensuring that the application still renders results for successful calls even if others fail. The token verification will remain in place before any API calls are initiated. I will also make a minor adjustment to `./views/index.ejs` to ensure that the initial 'Processing...' messages are displayed correctly when the form is submitted.

I will modify the following files:
- `./src/index.ts`
- `./views/index.ejs`

## Modified file: `./src/index.ts`

```typescript
import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
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
app.use(cookieParser());
const csrfProtection = csrf({ cookie: true });

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
  // Add values for form fields to retain them after a GET request or error
  job: '',
  language: 'English',
  position: '',
  words: '100',
  token: '',
  company: '',
  searchCompany: true,
};

app.get('/', csrfProtection, (req: Request, res: Response) => {
  res.render('index', {
    ...initialRenderOptions,
    csrfToken: (req as any).csrfToken() // Pass CSRF token to the template
  });
});

app.post('/', csrfProtection, async (req: Request, res: Response) => {
  const { job, language, position, words, token: submittedToken, company, searchCompany } = req.body;
  const companyFromRequest = company;
  const searchCompanyInfo = searchCompany === 'true';

  // Base options for re-rendering the form in case of errors in POST
  // Preserve form input values
  const baseRenderOptionsForPost = {
    envErrors: envErrors,
    geminiCVResult: "An error occurred or input was missing.",
    openAICVResult: "An error occurred or input was missing.",
    geminiCoverLetterResult: "An error occurred or input was missing.",
    openAICoverLetterResult: "An error occurred or input was missing.",
    csrfToken: (req as any).csrfToken(), // Crucial for re-rendering the form
    formError: null as string | null,
    job: job || '',
    language: language || 'English',
    position: position || '',
    words: words || '100',
    token: submittedToken || '',
    company: companyFromRequest || '',
    searchCompany: searchCompanyInfo,
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

  // Set initial "Processing..." state for rendering while waiting for API calls
  res.render('index', {
    ...baseRenderOptionsForPost,
    geminiCVResult: "Processing...",
    openAICVResult: "Processing...",
    geminiCoverLetterResult: "Processing...",
    openAICoverLetterResult: "Processing...",
    formError: null,
  });

  // Parallelize API calls
  const [geminiCVResult, openAICVResult, geminiCoverLetterResult, openAICoverLetterResult] = await Promise.allSettled([
    getGeminiCVResult(job, position, language),
    getOpenAICVResult(job, position, language),
    getGeminiCoverLetterResult(companyForProcessing, position, job, language, words, searchCompanyInfo),
    getOpenAICoverLetterResult(companyForProcessing, position, job, language, words, searchCompanyInfo),
  ]);

  const results = {
    geminiCV: geminiCVResult.status === 'fulfilled' ? geminiCVResult.value : `<div class="alert alert-danger">Error generating CV with Gemini: ${geminiCVResult.reason instanceof Error ? geminiCVResult.reason.message : 'Unknown error occurred'}</div>`,
    openAICV: openAICVResult.status === 'fulfilled' ? openAICVResult.value : `<div class="alert alert-danger">Error generating CV with OpenAI: ${openAICVResult.reason instanceof Error ? openAICVResult.reason.message : 'Unknown error occurred'}</div>`,
    geminiCoverLetter: geminiCoverLetterResult.status === 'fulfilled' ? geminiCoverLetterResult.value : `Error generating Cover Letter with Gemini: ${geminiCoverLetterResult.reason instanceof Error ? geminiCoverLetterResult.reason.message : 'Unknown error occurred'}`,
    openAICoverLetter: openAICoverLetterResult.status === 'fulfilled' ? openAICoverLetterResult.value : `Error generating Cover Letter with OpenAI: ${openAICoverLetterResult.reason instanceof Error ? openAICoverLetterResult.reason.message : 'Unknown error occurred'}`,
  };

  // Re-render the page with the actual results (or errors)
  res.render('index', {
    ...baseRenderOptionsForPost, // Keep form values
    geminiCVResult: results.geminiCV,
    openAICVResult: results.openAICV,
    geminiCoverLetterResult: results.geminiCoverLetter,
    openAICoverLetterResult: results.openAICoverLetter,
    formError: null,
  });
});

// CSRF error handler middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.warn('CSRF Token Validation Failed for request to:', req.path);
    // Render the page again with an error message and a new CSRF token
    res.status(403).render('index', {
      ...initialRenderOptions, // Use initial state for results display but preserve form data if available
      csrfToken: (req as any).csrfToken ? (req as any).csrfToken() : '', // Attempt to get a new token
      formError: 'Invalid form submission token. Please refresh the page and try again. Ensure cookies are enabled in your browser.',
      // Attempt to repopulate form fields from the invalid request body
      job: req.body.job || '',
      language: req.body.language || 'English',
      position: req.body.position || '',
      words: req.body.words || '100',
      token: req.body.token || '',
      company: req.body.company || '',
      searchCompany: req.body.searchCompany === 'true',
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

## Modified file: `./views/index.ejs`

```ejs
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/css/flag-icons.min.css" />
    <title>Job Application Assistant</title>
  </head>
  <body>

    <div class="container">

      <% if (typeof envErrors !== 'undefined' && envErrors.length > 0) { %>
        <div class="alert alert-danger mt-3" role="alert">
          <h4 class="alert-heading">Configuration Error!</h4>
          <p>The application has detected the following configuration issues. Please resolve them for full functionality:</p>
          <hr>
          <ul>
            <% envErrors.forEach(function(error) { %>
              <li><%- error %></li>
            <% }); %>
          </ul>
        </div>
      <% } %>

      <h2 class="mt-4">Generated Documents</h2>

      <!-- New Row for CV Results -->
      <h3 class="mt-3">Tailored CVs</h3>
      <div class="row">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              Gemini CV Result
            </div>
            <div class="card-body" id="geminiCVResult">
              <% if (geminiCVResult === "Processing...") { %>
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                Processing...
              <% } else { %>
                <%- geminiCVResult %>
              <% } %>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              OpenAI CV Result
            </div>
            <div class="card-body" id="openAICVResult">
              <% if (openAICVResult === "Processing...") { %>
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                Processing...
              <% } else { %>
                <%- openAICVResult %>
              <% } %>
            </div>
          </div>
        </div>
      </div>

      <!-- Existing Row for Cover Letter Results -->
      <h3 class="mt-4">Cover Letters</h3>
      <div class="row mt-3">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              Gemini Cover Letter Result
            </div>
            <div class="card-body" id="geminiCoverLetterResult" style="white-space: pre-wrap;">
              <% if (geminiCoverLetterResult === "Processing...") { %>
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                Processing...
              <% } else { %>
                <%- geminiCoverLetterResult %>
              <% } %>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              OpenAI Cover Letter Result
            </div>
            <div class="card-body" id="openAICoverLetterResult" style="white-space: pre-wrap;">
              <% if (openAICoverLetterResult === "Processing...") { %>
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                Processing...
              <% } else { %>
                <%- openAICoverLetterResult %>
              <% } %>
            </div>
          </div>
        </div>
      </div>

      <h2 class="mt-4">Generate Documents</h2>

      <%# Display form-specific errors, including CSRF errors %>
      <% if (typeof formError !== 'undefined' && formError) { %>
        <div class="alert alert-danger mt-3" role="alert">
          <%- formError %>
        </div>
      <% } %>

      <form class="mt-4" action="/" method="POST">
        <%# CSRF Token %>
        <input type="hidden" name="_csrf" value="<%= csrfToken %>">
        
        <div class="mb-3">
          <label for="token" class="form-label">Token</label>
          <input type="text" class="form-control" id="token" placeholder="Enter token" name="token" value="<%= typeof token !== 'undefined' ? token : '' %>">
        </div>
        <div class="mb-3">
          <label for="company" class="form-label">Company name</label>
          <input type="text" class="form-control" id="company" placeholder="Enter company name" name="company" value="<%= typeof company !== 'undefined' ? company : '' %>">
        </div>
        <div class="mb-3 form-check">
          <input type="checkbox" class="form-check-input" id="searchCompany" name="searchCompany" value="true" <%= typeof searchCompany !== 'undefined' && searchCompany ? 'checked' : '' %>>
          <label class="form-check-label" for="searchCompany">Attempt to use specific information about the company (if name provided)</label>
        </div>
        <div class="mb-3">
          <label for="position" class="form-label">Position</label>
          <input type="text" class="form-control" id="position" placeholder="Enter position" name="position" value="<%= typeof position !== 'undefined' ? position : '' %>">
        </div>
        <div class="mb-3">
          <label for="job" class="form-label">Job description (will be used for CV and Cover Letter)</label>
          <textarea id="job" class="form-control" rows="15" name="job" placeholder="Paste the full job description here..."><%= typeof job !== 'undefined' ? job : '' %></textarea>
        </div>
        <div class="mb-3">
          <label class="form-label">Language</label>
          <div class="border p-2 rounded">
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="languageen" name="language" value="English" <%= typeof language !== 'undefined' && language === 'English' ? 'checked' : '' %>>
              <label class="form-check-label" for="languageen">
                <span class="fi fi-gb me-2"></span>English
              </label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="languagefr" name="language" value="French" <%= typeof language !== 'undefined' && language === 'French' ? 'checked' : '' %>>
              <label class="form-check-label" for="languagefr">
                <span class="fi fi-fr me-2"></span>French
              </label>
            </div>
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label">Number of words (for Cover Letter)</label>
          <div class="border p-2 rounded">
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="words" id="words100" value="100" <%= typeof words !== 'undefined' && words === '100' ? 'checked' : '' %>>
              <label class="form-check-label" for="words100">100</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="words" id="words200" value="200" <%= typeof words !== 'undefined' && words === '200' ? 'checked' : '' %>>
              <label class="form-check-label" for="words200">200</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="words" id="words300" value="300" <%= typeof words !== 'undefined' && words === '300' ? 'checked' : '' %>>
              <label class="form-check-label" for="words300">300</label>
            </div>
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Generate</button>
      </form>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const searchCompanyCheckbox = document.getElementById('searchCompany');
        const companyInput = document.getElementById('company');
        const companyLabel = document.querySelector('label[for="company"]');

        function updateCompanyInputState() {
          if (searchCompanyCheckbox.checked) {
            companyInput.disabled = false;
            companyInput.placeholder = "Enter company name (required for company-specific info)";
            companyLabel.textContent = "Company name (required for search)";
            // Only clear if it was previously set to 'Unknown' by the script, not if user typed something
            if (companyInput.value === 'Unknown') {
              companyInput.value = '';
            }
          } else {
            companyInput.disabled = true;
            companyInput.placeholder = "Company information will not be used";
            companyLabel.textContent = "Company name (will not be used)";
            companyInput.value = 'Unknown';
          }
        }

        searchCompanyCheckbox.addEventListener('change', updateCompanyInputState);
        // Initial state update when page loads
        updateCompanyInputState();

        // Ensure that if the form was submitted with searchCompany unchecked,
        // and 'Unknown' was set, it remains 'Unknown' if the form re-renders due to an error.
        // This is handled by the server-side logic now passing the value back.
      });
    </script>
  </body>
</html>

```

GoogleAI gemini-2.5-flash (8.35k in, 4.99k out)


