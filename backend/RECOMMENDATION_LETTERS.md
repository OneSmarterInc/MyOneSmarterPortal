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

Saving stores an unsigned PDF preview and its data snapshot in the database. Approval adds a certificate signature as an incremental PDF update, preserving the reviewed page content, and stores the signed PDF before sending it. The emailed attachment and subsequent downloads use the same signed bytes. Later account edits cannot silently alter the approved document. A revision check prevents stale approvals, and a transaction claims the send so concurrent clicks cannot dispatch the same request twice. An already sent request returns its existing result without resending.

## Certificate signing setup (Ubuntu)

Signing is mandatory for new approvals. Missing/unreadable credentials, wrong passwords, invalid certificate dates, disallowed key usage, or signing failures stop approval before email is attempted. Draft previews still work. Previously sent PDFs are not modified or emailed again.

Install the production dependencies (includes pyHanko). Keep the PKCS#12 certificate outside the repository and web root. The existing service runs as `ubuntu`, so `/home/ubuntu/onesmarter-signing/onesmarter-signing.p12` should be owned by ubuntu, mode 600, within a mode 700 directory.

Create a password file on the server without putting the password in shell history:

```bash
(
  umask 077
  read -r -s -p 'PKCS#12 export password: ' signing_password
  printf '\n'
  printf '%s' "$signing_password" > /home/ubuntu/onesmarter-signing/password
  unset signing_password
)
```

Run `sudo systemctl edit onesmarter-backend.service` and add:

```ini
[Service]
Environment="LOR_SIGNING_P12_PATH=/home/ubuntu/onesmarter-signing/onesmarter-signing.p12"
Environment="LOR_SIGNING_PASSWORD_FILE=/home/ubuntu/onesmarter-signing/password"
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart onesmarter-backend.service
systemctl is-active onesmarter-backend.service
```

Do not commit keys, certificate archives, or passwords. The public certificate can be shared for verification. Rotate the PKCS#12 and password files together when renewing the certificate; existing sent PDFs retain their original signatures. A retry after SMTP failure reuses the already signed attachment; saving a revised draft clears that signature and requires signing the new revision.

The PDF uses an embedded signature named `OneSmarterApproval`, visible in a supporting reader's signature panel. The existing printed sign-off stays unchanged. A self-signed certificate requires recipients to independently verify and trust the certificate; the signer name alone does not establish identity. No trusted timestamp service or long-term validation data is configured. The signing time uses the server clock. Keep the private key accessible only to authorized server processes; anyone able to read both credential files can sign as this certificate.

`Sent` means the SMTP server accepted the email, not that inbox delivery is guaranteed. `Send failed` requires checking SMTP logs and the recipient inbox before retrying, because SMTP failures can have ambiguous outcomes. If a worker stops during a send, the request may remain `Sending`; investigate the mail server before an operator resets it. It is not automatically resent.

Employees can only read their own requests and download their own sent letters. Drafts, approval, and rejection require a server-verified administrator account. All letter PDF responses use `Cache-Control: no-store`.

## Validation

`python manage.py test attendance.test_recommendations --settings=test_settings`

Tests use Django's in-memory mail backend and do not send real email. Back up the database before deployment as usual; reverting application code should leave the new request records intact.
