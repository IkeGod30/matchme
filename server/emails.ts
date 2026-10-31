import type { Email } from './mailer.ts'

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function layout(body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#fbf7f5;font-family:Segoe UI,Arial,sans-serif;color:#241c1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:14px;padding:28px">
<tr><td style="font-size:18px;font-weight:700;padding-bottom:16px"><span style="color:#d6336c">&#9829;</span> MatchMe</td></tr>
<tr><td style="font-size:15px;line-height:1.55">${body}</td></tr>
</table></td></tr></table></body></html>`
}

export function passwordResetEmail(to: string, link: string): Email {
  return {
    to,
    subject: 'Reset your MatchMe password',
    text: [
      'Hello,',
      '',
      'We received a request to reset the password for your MatchMe account.',
      'Open this link to choose a new password (it expires in 1 hour and works once):',
      '',
      link,
      '',
      'If you didn’t ask for this, you can ignore this email — your password won’t change.',
      '',
      '— MatchMe',
    ].join('\n'),
    html: layout(`<p>Hello,</p>
<p>We received a request to reset the password for your MatchMe account.</p>
<p style="padding:8px 0"><a href="${escape(link)}" style="background:#d6336c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Choose a new password</a></p>
<p style="color:#6f6266;font-size:13px">This link expires in 1 hour and can be used once. If the button doesn’t work, copy this address into your browser:<br><a href="${escape(link)}" style="color:#b02457;word-break:break-all">${escape(link)}</a></p>
<p style="color:#6f6266;font-size:13px">If you didn’t ask for this, you can ignore this email — your password won’t change.</p>`),
  }
}

export function matchmakerInviteEmail(to: string, link: string, inviter: string): Email {
  return {
    to,
    subject: `${inviter} invited you to join MatchMe as a matchmaker`,
    text: [
      'Hello,',
      '',
      `${inviter} has invited you to join the MatchMe matchmaking team.`,
      'Open this link to create your matchmaker account (it expires in 7 days and works once):',
      '',
      link,
      '',
      '— MatchMe',
    ].join('\n'),
    html: layout(`<p>Hello,</p>
<p><strong>${escape(inviter)}</strong> has invited you to join the MatchMe matchmaking team.</p>
<p style="padding:8px 0"><a href="${escape(link)}" style="background:#d6336c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Create my matchmaker account</a></p>
<p style="color:#6f6266;font-size:13px">This link expires in 7 days and can be used once. If the button doesn’t work, copy this address into your browser:<br><a href="${escape(link)}" style="color:#b02457;word-break:break-all">${escape(link)}</a></p>`),
  }
}

export function matchmakerApplicationEmail(to: string, applicant: string, dashboardLink: string): Email {
  return {
    to,
    subject: `New matchmaker application from ${applicant}`,
    text: [
      'Hello,',
      '',
      `${applicant} has applied to join the MatchMe matchmaking team.`,
      'Review the application in Dashboard → Team and approve or decline it:',
      '',
      dashboardLink,
      '',
      '— MatchMe',
    ].join('\n'),
    html: layout(`<p>Hello,</p>
<p><strong>${escape(applicant)}</strong> has applied to join the MatchMe matchmaking team.</p>
<p>Review the application in <strong>Dashboard → Team</strong> and approve or decline it.</p>
<p style="padding:8px 0"><a href="${escape(dashboardLink)}" style="background:#d6336c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Open MatchMe</a></p>`),
  }
}

export function applicationDecisionEmail(to: string, name: string, approved: boolean, link: string): Email {
  const subject = approved ? 'You’re now a MatchMe matchmaker' : 'Your MatchMe matchmaker application'
  const message = approved
    ? 'Good news — your application to join the MatchMe matchmaking team has been approved. Log in to start taking on requests.'
    : 'Thank you for applying to join the MatchMe matchmaking team. We’re not able to approve your application at this time, and your account has been removed.'
  return {
    to,
    subject,
    text: [`Hello ${name},`, '', message, ...(approved ? ['', link] : []), '', '— MatchMe'].join('\n'),
    html: layout(`<p>Hello ${escape(name)},</p><p>${escape(message)}</p>${
      approved
        ? `<p style="padding:8px 0"><a href="${escape(link)}" style="background:#d6336c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Log in to MatchMe</a></p>`
        : ''
    }`),
  }
}

export function passwordChangedEmail(to: string): Email {
  return {
    to,
    subject: 'Your MatchMe password was changed',
    text: [
      'Hello,',
      '',
      'The password for your MatchMe account was just changed, and you were signed out on other devices.',
      '',
      'If this wasn’t you, reset your password straight away using “Forgot your password?” on the login page, and contact us.',
      '',
      '— MatchMe',
    ].join('\n'),
    html: layout(`<p>Hello,</p>
<p>The password for your MatchMe account was just changed, and you were signed out on other devices.</p>
<p style="color:#6f6266;font-size:13px">If this wasn’t you, reset your password straight away using “Forgot your password?” on the login page, and contact us.</p>`),
  }
}
