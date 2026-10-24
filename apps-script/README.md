# Lead form → Google Sheets + email (Apps Script)

Each enquiry from the website goes through this flow:

1. Visitor submits the form → browser checks the fields, disables the button and shows "Submitting…".
2. `doPost` in `Code.gs` validates and sanitises the data on the server, blocks bots (honeypot + timing) and rate-limits repeat senders.
3. It creates a unique **Lead ID** (`LEAD-YYYYMMDD-XXXXXX`), checks that ID is unique, and appends one row to the **Leads** sheet.
4. It emails **sathishpandian1989@gmail.com** with the Lead ID in the subject. If the email fails, the lead stays saved and is marked `RETRY_PENDING`. A trigger retries it every 15 minutes.
5. The visitor sees a success message with their reference only after the row is saved. If saving fails, they see an error and the WhatsApp, phone and email contacts.

Every step is written to a private **Logs** sheet as one of RECEIVED, VALIDATED, SHEET_SAVED, EMAIL_SENT, RETRY_PENDING or FAILED. Logs hold IDs and error codes only, never full form data. Log rows older than 90 days are deleted automatically.

## One-time setup (about 10 minutes)

1. Create a new Google Sheet (e.g. "Digifyhub Leads") while signed in as the account that should own the leads.
2. **Extensions → Apps Script.** Delete the sample code and paste in all of `Code.gs`. Save.
3. In the function dropdown choose **`setup`** → **Run**. Approve the permissions (Sheets, Gmail send, triggers). This creates the `Leads` and `Logs` tabs, the dropdowns, the colour coding and the triggers.
4. (Optional) Run **`testSubmission`**. A test row should appear and an email should arrive.
5. **Deploy → New deployment →** type **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (visitors don't sign in; the sheet itself stays private)
   - Click **Deploy** and copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).
6. Open `docs/assets/js/config.js` and paste the URL:
   ```js
   FORM_ENDPOINT: 'https://script.google.com/macros/s/XXXX/exec',
   ```
   Commit and push. GitHub Pages updates within a minute or two.

> **When you change `Code.gs` later:** use **Deploy → Manage deployments → Edit (pencil) → Version: New version**. This keeps the same URL. A *New deployment* creates a new URL.

## Sheet columns

`Lead ID · Timestamp · Name · Phone · Email · Business Name · Service Interest · Message · Landing Page / Source · Consent · Processing Status · Error / Retry Status · Email Retries · Duplicate Flag · Lead Status · Follow-up Status · Follow-up Date · Submission Key`

Use **Lead Status**, **Follow-up Status** and **Follow-up Date** to manage your pipeline. They have dropdowns and a date picker.

## Duplicates and spam

| Situation | What happens |
|---|---|
| Double-click, page refresh or network retry | The browser resends the same submission key, so no second row is created and the visitor gets the original Lead ID |
| Same email/phone sends a *new* enquiry within 24h | A new row is saved and the **Duplicate Flag** column points at the earlier Lead ID, so nothing is discarded |
| More than 5 submissions from one contact in 10 min | Rejected with a "please wait" message |
| Hidden honeypot field filled, or the form submitted within 2.5s of the page loading | The bot is told it succeeded, but nothing is stored |

Tune these values in the `CONFIG` block at the top of `Code.gs`. For heavier spam, you can add Cloudflare Turnstile or reCAPTCHA. Check its token inside `doPost` and keep the secret key in **Project Settings → Script properties**, never in the website code.

## Security notes

- Keep the Google Sheet shared only with people who need it. The web app URL lets visitors **add** leads but not read them.
- No API keys or Google credentials are ever placed in the website code.
- Gmail sending quota for consumer accounts is about 100 emails/day. That is plenty for lead alerts.
