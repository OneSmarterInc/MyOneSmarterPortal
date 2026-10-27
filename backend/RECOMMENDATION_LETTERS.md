# Recommendation letters

Employees and interns request a letter in **Recommendation letters**. Administrators use the same menu entry to prepare, preview, reject, or approve and email it.

## Deployment

- Install `requirements-production.txt` (adds ReportLab), then run migrations. The backend deployment workflow runs these steps.
- Deploy the frontend separately.
- Users with an existing browser session must sign out and sign in again. Login now supplies a signed, password-bound token for letter endpoints. It expires after 24 hours; signing in refreshes it. A password change invalidates it. These checks are scoped to the new endpoints; they do not retrofit authorization across older portal APIs.
- Configure the existing Email settings. Mail uses that configured sender to respect SMTP sender restrictions; replies and the letter contact use `akshay.kumar@onesmarter.com`.
- For exact Times New Roman on Linux, install licensed regular and bold TTF files on the server and set `LOR_FONT_REGULAR` and `LOR_FONT_BOLD` to their absolute paths in the backend service environment, then restart the service. Windows uses installed Times New Roman when available. If the files are absent, PDFs use built-in Times-Roman/Times-Bold. Fonts are not redistributed in this repository.

## Record handling

The name and joining date are read from the account when saving. Missing or future joining dates prevent saving. An empty end date produces wording that employment continues as of the letter's issue date. The signatory is Akshay Agrawal, Global Delivery Manager. No scanned signature is copied.

Saving stores a PDF and its data snapshot in the database. Approval sends those exact bytes; later account edits cannot silently alter the approved document. A revision check prevents stale approvals, and a transaction claims the send so concurrent clicks cannot dispatch the same request twice. An already sent request returns its existing result without resending.

`Sent` means the SMTP server accepted the email, not that inbox delivery is guaranteed. `Send failed` requires checking SMTP logs and the recipient inbox before retrying, because SMTP failures can have ambiguous outcomes. If a worker stops during a send, the request may remain `Sending`; investigate the mail server before an operator resets it. It is not automatically resent.

Employees can only read their own requests and download their own sent letters. Drafts, approval, and rejection require a server-verified administrator account. All letter PDF responses use `Cache-Control: no-store`.

## Validation

`python manage.py test attendance.test_recommendations --settings=test_settings`

Tests use Django's in-memory mail backend and do not send real email. Back up the database before deployment as usual; reverting application code should leave the new request records intact.
