# Zoho SMTP Setup — Cortex LMS Email Invitations

**For:** IT Head
**From:** Development Team
**Subject:** Zoho Mail SMTP credentials needed for Cortex LMS

---

## What We're Doing and Why

We've added an **automatic email invitation feature** to the Cortex LMS.
Whenever an admin creates a new user account (individually or via bulk CSV upload), the system will automatically send that user a welcome email containing:

- Their **username** (email address)
- Their **temporary password**
- A direct link to the Cortex LMS login page
- Instructions to change their password after first login

To send these emails, the application needs outbound SMTP access through the `noreply@iohealth.com` Zoho Mail account.

---

## Steps to Set Up

### 1. Log in to Zoho Mail Admin Console
Go to: **https://mailadmin.zoho.com**
Sign in with an admin account for the `iohealth.com` domain.

### 2. Verify the noreply@iohealth.com Mailbox Exists
- Navigate to **Mail Accounts** in the left sidebar
- Confirm `noreply@iohealth.com` exists
- If it doesn't exist yet: click **Add User** → set the address to `noreply`, name to `Cortex LMS No-Reply`, and assign a strong password

### 3. Generate an App-Specific Password
This is more secure than using the main account password directly:
1. Log in to **https://accounts.zoho.com** as `noreply@iohealth.com`
2. Go to **Security → App Passwords**
3. Click **Generate New App Password**
4. Name it: `Cortex LMS SMTP`
5. Copy the generated password — **you will not be able to see it again**

### 4. Confirm SMTP Settings
Zoho SMTP settings for `iohealth.com`:

| Setting | Value |
|---------|-------|
| SMTP Host | `smtp.zoho.com` |
| SMTP Port | `587` |
| Encryption | `STARTTLS` (not SSL) |
| Username | `noreply@iohealth.com` |
| Password | *(app-specific password from Step 3)* |

### 5. Provide the App Password to the Dev Team
Send the generated app-specific password securely (Google Chat DM, not email).
The dev team will add it to the application's environment variables as `SMTP_PASS`.

---

## What the Dev Team Will Do With It

The password will be stored **only** in the server's `.env` file (never in source code or Git).
The application will use it to send emails from `noreply@iohealth.com` with:
- **Reply-To:** `no-reply@iohealth.com` (replies go nowhere — this is intentional for a no-reply address)
- **From display name:** `Cortex LMS <noreply@iohealth.com>`

---

## Testing After Setup

Once the credentials are in place, the dev team will:
1. Create a test user account
2. Confirm the invitation email arrives with correct login details
3. Confirm replies to the email bounce or go unmonitored

---

## If You Hit Issues

- **"Authentication failed"**: Make sure you're using the App Password (Step 3), not the Zoho account password
- **Port 587 blocked**: Try port 465 with SSL (`SMTP_SECURE=true`) — let the dev team know so they can update the config
- **Domain SPF/DKIM**: If emails land in spam, the Zoho admin console has an option under **Email Authentication** to set up SPF and DKIM records for `iohealth.com`

---

*This setup is a one-time task. Once done, the LMS will handle all invitation emails automatically with no further IT involvement.*
