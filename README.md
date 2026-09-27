# ThreatShare

ThreatShare is a React and Express threat intelligence workspace. The application uses a local MongoDB database for persistence.

## Local setup

1. Install and start MongoDB locally.
2. Copy `.env.example` to `.env` and set a local `JWT_SECRET`.
3. Run `npm install`.
4. Run `npm run seed` to load the starter threats and alerts.
5. Run `npm run server:dev` in one terminal.
6. Run `npm run dev` in another terminal.

The local demo login is `admin@threatshare.local` with password `demo-password`.

## IoC behavior

- Indicators are normalized before lookup, so casing and surrounding whitespace do not create false new records.
- An exact existing indicator becomes a re-sighting, increments its sighting count, and reopens dismissed threats.
- New indicators in the same category are linked in both directions as correlated threats.
- Critical indicators, and high-severity correlated indicators, create open escalation alerts automatically.

## Permissions

- Administrators can manage users, workspace settings, threats, alerts, and reports.
- Systems Analysts can view intelligence, submit indicators, dismiss alerts, and generate reports.
- Viewers have read-only access.

Passwords are stored as bcrypt hashes. The API uses JWT sessions, checks that the account is still active on every request, applies login rate limiting, and sends security headers with Helmet. The local development connection does not enable MongoDB TLS or encryption at rest; configure both before using a shared or production database.