# Automatic employee and intern IDs

IDs follow EmployeeDetails.xlsx: uppercase first/last initials + joining date YYMMDD + a number padded to at least two digits. Both employees and interns use the same format, without an E/I prefix. Example: SA26081006. IDs are public references, not authentication credentials.

Migration 0018 replaces existing IDs for employees and interns, including inactive accounts. It imports spreadsheet names and joining dates only for unambiguous matches: full name, username or email local-part matching the full name; otherwise a first-name-only match must be unique in both source and accounts. Ambiguous matches use account data without guessing identities. Managers and students are not updated.

The initial number is the alphabetical position by first name and then last name within the joining date, across both roles. Duplicate names use profile primary key as a stable tiebreaker to guarantee unique IDs. New accounts receive the next available daily number. A locked database counter prevents concurrent allocation of the same number and retains consumed numbers after deletion.

Once assigned, an ID stays fixed across name, joining-date and role changes. API and model saves reject or ignore manual ID edits. The creation form collects first/last names and a joining date; the welcome email contains the generated ID.

For accounts outside the spreadsheet, existing first/last names are used, falling back to the username's first/last words. A single name produces one initial, as Excel does with a blank last name. No joining date is invented: missing-date accounts retain their previous ID (or remain blank if new), and receive the new format when the administrator supplies a joining date. Migration output identifies deferred profile IDs.

Deploy migrations before serving new code. Do not create profiles with bulk_create/raw SQL, which bypass automatic allocation. Reversing the data migration does not restore previous IDs or spreadsheet-updated details.

Validate with `python manage.py test attendance.test_employee_ids --settings=test_settings --noinput`.
