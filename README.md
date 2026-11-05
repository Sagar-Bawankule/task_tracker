# Shree Beauty – Work Tracker

Task and work tracker for the Shree Beauty office: daily work logs, weekly summaries and monthly reports.

## What it does

| Page | What you see |
|---|---|
| **Dashboard** | Your open tasks, hours today and this week, a quick "log today's work" form. Admins also see who hasn't logged today. |
| **Daily** | Any day's work log (grouped per person for admins), tasks completed and tasks due that day. You can add a missed entry for a past day. |
| **Weekly Summary** | Mon–Sun totals, hours-per-day chart, time by category, team table (hours, days logged, tasks done, open, overdue), and the day-by-day log. CSV export and Print/PDF. |
| **Monthly** | Calendar heat-map, week-by-week breakdown, team table, categories, completed tasks. Work log and tasks CSV export. |
| **Tasks** | Create, assign and filter tasks (status, person, priority, category, search). Change status inline. |
| **Team** (admin) | Add staff, set the Admin/Member role, reset passwords, deactivate leavers. |

**Roles:** *Admins* see the whole team and can filter any page to one person. *Members* see only their own tasks and logs.

## Run on your computer

Needs Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first visit asks you to create the **admin account**. Locally, data is stored in the `.pglite` folder, so no database setup is needed.

## Deploy to Vercel

1. Put this folder in a GitHub repository, then on vercel.com choose **Add New → Project** and import it.
   (Or run `npx vercel` from this folder.)
2. In the Vercel project, open **Storage → Create Database → Neon (Postgres)** and connect it to the project.
   This sets `DATABASE_URL` automatically. The free plan is enough.
3. Open **Settings → Environment Variables** and add:
   - `AUTH_SECRET`: a long random value. Generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `APP_TIMEZONE`: `Asia/Kolkata` (optional; this is the default)
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables take effect.
5. Open your site **right away** and create the admin account. The first person to visit becomes admin.
   Then add your staff under **Team** and share their email and temporary password with them.

Tables are created automatically on first use.

## Notes

- Weeks run Monday to Sunday. "Today" uses `APP_TIMEZONE`.
- Hours are rounded to the nearest 15 minutes. Work can't be logged for future dates.
- Marking a task **Done** records the completion date. That date drives the "tasks completed" numbers in the daily, weekly and monthly views.
- Tech: Next.js 16 (App Router, server actions), Postgres (Neon on Vercel, PGlite locally), Tailwind CSS 4.
