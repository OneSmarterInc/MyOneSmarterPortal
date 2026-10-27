# Deploy full internal My Policies documents

The OneSmarter employee portal reads full policy content from a private JSON document bundle. The original internal documents and their text must **not** be committed to this public repository or served from the frontend /public directory.

1. Obtain `OneSmarter_Private_Policies.zip` from the approved internal administrator.
2. Transfer it to the **backend server** via an approved secure channel. Extract into a directory accessible only by the backend service account, for example `/opt/onesmarter/private_policies/documents.json`.
3. Restrict filesystem permissions for the extracted content. Do not place it under nginx static/media or any public web root.
4. Set `OSI_PRIVATE_POLICIES_JSON=/opt/onesmarter/private_policies/documents.json` for the backend systemd/container environment, then restart the backend.
5. Sign into the employee portal, navigate to **My Policies**, and check that all 22 documents display full paragraphs and tables. The page uses the existing signed Bearer token returned at login. If expired, sign in again.

The API endpoint is `GET /api/my-policies/` for metadata and `GET /api/my-policies/?id=<document-id>` for full content. Both require authentication via the current signed session token.

When replacing a policy version, update the private server bundle through the controlled document-approval process. Do not alter or silently rewrite approved policy wording.
