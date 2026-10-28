# Automatic employee and intern IDs

Employees receive an ID such as `E-7K4M9Q`; interns receive `I-8H6P2R`. Six random uppercase letters/digits follow the prefix. The alphabet omits 0, 1, I and O to reduce transcription mistakes. IDs are public account references, not authentication credentials.

Migration `0017_automatic_employee_ids` assigns IDs to every existing employee and intern, including inactive accounts, replacing blank or old manually entered IDs. Existing IDs already matching the new format are retained when unique. The migration must run before the new code serves requests; the backend deployment workflow already runs migrations. The reverse migration retains assigned ID values.

Normal model saves assign IDs automatically and preserve existing IDs against manual changes. A database uniqueness constraint protects employees and interns against duplicate IDs, and generation retries collisions. Bulk creation or raw SQL bypasses model hooks and should not be used to provision profiles. Account creation emails contain the generated ID.

Changing an intern's role to employee automatically changes the prefix from I to E, preserving the suffix unless it collides with another employee's ID. Other profile edits never change the ID. Managers and legacy student accounts do not receive these team IDs until their role becomes employee or intern.

Create forms no longer require ID entry. Directory edit forms and personal profiles show read-only IDs, and directory search includes the ID. Both profile-update endpoints reject changed ID values before saving any other fields. The model field is also non-editable for generated model forms. This does not change the existing authentication system.

Validate with `python manage.py test attendance.test_employee_ids --settings=test_settings --noinput`.
