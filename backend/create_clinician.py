"""Create a Doctor or Caregiver account. Run this on the server only; there is no self-registration.
Usage:  python create_clinician.py "Dr Name" email@example.com password123 Doctor
Role is Doctor or Caregiver. Members then grant access to this email in Profile and privacy."""
import sys
import main

if len(sys.argv) != 5 or sys.argv[4] not in ("Doctor", "Caregiver") or len(sys.argv[3]) < 8:
    sys.exit(__doc__)
name, email, pw, role = sys.argv[1:5]
if main.q("SELECT 1 FROM users WHERE email=?", (email.strip().lower(),), one=True): sys.exit("An account with this email already exists.")
main.new_user(name, email, pw, role)
print(f"Created {role} account for {email}")
