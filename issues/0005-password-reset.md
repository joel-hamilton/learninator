---
status: backlog
priority: low
created: 2026-06-12
---

# Password reset flow

**What**: Self-service password reset via email.

**Why**: Currently users must text the admin to reset their password. Fine for a personal tool with a few friends, but will be needed eventually.

**Acceptance criteria**:
- [ ] "Forgot password?" link on login page
- [ ] Enter email → receive reset link
- [ ] Reset link sets new password
- [ ] Email sending infra (SMTP or transactional email service)

**Notes**: Requires email sending which adds infra complexity. Defer until needed.
