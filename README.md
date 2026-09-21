# Justice Desk

Justice Desk is a TypeScript and Express API for legal consultation, lawyer scheduling, appointments, payments, and case collaboration.

## Stack

- Node.js with TypeScript
- Express 5
- Prisma ORM 7 with PostgreSQL
- Zod request validation
- Redis for application support
- Cloudinary for uploaded files
- Stripe and bKash payment integrations
- Nodemailer for email delivery
- Biome for formatting and linting

## Requirements

Install the following before starting the API:

- Node.js
- PostgreSQL
- Redis
- Stripe CLI if Stripe webhooks are used
- Cloudinary, SMTP, Stripe, and bKash credentials for the related features

## Installation

```bash
npm install
```

Create a `.env` file in the project root. The application reads these variables from `.env`:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
BACKEND_URL=http://localhost:5000
APP_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

BCRYPT_SALT_ROUNDS=12
JWT_ACCESS_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=replace-me

SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=replace-me
TESTER_ADMIN_NAME=Tester Admin
TESTER_ADMIN_EMAIL=test-admin@example.com
TESTER_ADMIN_PASSWORD=replace-me
TESTER_LAWYER_NAME=Tester Lawyer
TESTER_LAWYER_EMAIL=test-lawyer@example.com
TESTER_LAWYER_PASSWORD=replace-me

REDIS_USER=default
REDIS_PASSWORD=replace-me
REDIS_HOST=localhost
REDIS_PORT=6379

SMTP_USER=replace-me
SMTP_PASSWORD=replace-me
EMAIL_SENDER=replace-me

CLOUDINARY_CLOUD_NAME=replace-me
CLOUDINARY_API_KEY=replace-me
CLOUDINARY_API_SECRET=replace-me

BKASH_BASE_URL=replace-me
BKASH_USERNAME=replace-me
BKASH_PASSWORD=replace-me
BKASH_APP_KEY=replace-me
BKASH_APP_SECRET=replace-me
BKASH_CALLBACK_URL=http://localhost:5000/api/v1/appointment/book-appointment/payment/callback

STRIPE_PRODUCT_PRICE_ID=replace-me
STRIPE_SECRET_KEY=replace-me
STRIPE_WEBHOOK_SECRET=replace-me
BDT_TO_USD_RATE=replace-me
```

Do not commit `.env` or real credentials.

## Database

The Prisma schema is split across `prisma/schema`. Prisma is configured through `prisma7.config.ts`.

```bash
npx prisma generate
npx prisma migrate dev
```

The server connects to PostgreSQL, Redis, and SMTP during startup. It also seeds the configured super-admin, tester-admin, and tester-lawyer accounts when the relevant environment variables are present.

## Running the API

Development mode starts the API with watch mode and starts Stripe webhook forwarding to port `5000`:

```bash
npm run dev
```

To run only the API watcher:

```bash
npm run dev:server
```

Build and run the compiled server:

```bash
npm run build
npm start
```

The default base URL is:

```text
http://localhost:5000/api/v1
```

## Latest Workflow

### 1. Authenticate users

1. Register a client with `POST /auth/register`.
2. Verify the client email with `POST /auth/verify-email`.
3. Log in with `POST /auth/login` or Google login with `POST /auth/google`.
4. Send the access token as a bearer token on protected requests:

```http
Authorization: Bearer <access-token>
```

Lawyer accounts are approved through the lawyer/admin workflow. The server seeds a tester lawyer account for local development when configured.

### 2. Lawyer publishes availability

A lawyer creates a schedule with `POST /schedule`, then publishes it with `PATCH /schedule/:scheduleId/status`.

Schedules are capacity-based. The lawyer provides the available capacity for a date and time; the system assigns appointment serials as clients book. Clients can find bookable schedules with:

```http
GET /schedule/available
```

The client can select any future date that has an available published schedule. The previous fixed 20-minute slot model is not required by the current workflow.

### 3. Client books and pays for an appointment

1. The client books with `POST /appointment/book-appointment`.
2. The client completes payment with `POST /appointment/pay-appointment`.
3. Stripe payments use the raw-body webhook endpoint:

```http
POST /appointment/stripe/webhook
```

The application deliberately excludes this exact route from normal JSON parsing so Stripe signature verification works. bKash uses the configured callback route:

```http
GET /appointment/book-appointment/payment/callback
```

4. Lawyers view appointments with `GET /appointment/lawyer-appointments`.
5. Lawyers update appointment status with `PATCH /appointment/update-status/:appointmentId`.
6. Clients join with `POST /appointment/join/:appointmentId`. The appointment service records the joining time and returns the meeting information when available.

### 4. Client creates a case and lawyer is assigned

A client creates a case with:

```http
POST /case/create-case
```

Clients can list their cases with `GET /case/my-cases`. Administrators assign a lawyer with:

```http
PATCH /case/assign-lawyer/:caseId
```

Lawyers list assigned cases with `GET /case/lawyer-cases`. Case status changes use `PATCH /case/update-status/:caseId`; supported statuses are `OPEN`, `IN_PROGRESS`, `WAITING_FOR_CLIENT`, `RESOLVED`, and `CLOSED`.

### 5. Collaborate inside a case

The case collaboration routes are mounted separately:

| Area | Create | List by case | Single item |
| --- | --- | --- | --- |
| Legal documents | `POST /legal-document/:caseId` | `GET /legal-document/case/:caseId` | `GET /legal-document/:documentId` |
| Case activities | `POST /case-activity/:caseId` | `GET /case-activity/case/:caseId` | Varies by module |
| Case messages | `POST /case-message/:caseId` | `GET /case-message/:caseId` | Delete with `DELETE /case-message/:messageId` |
| Reports | `POST /case-report/:caseId` | `GET /case-report/case/:caseId` | `GET /case-report/:reportId` |
| Invoices | `POST /invoice/` | `GET /invoice/case/:caseId` | `GET /invoice/:invoiceId` |
| Lawyer notes | `POST /lawyer-note/:caseId` | `GET /lawyer-note/case/:caseId` | `GET /lawyer-note/:noteId` |

For create requests, `caseId` comes from the URL. Do not duplicate it in the JSON body. For example, create a report with:

```http
POST /api/v1/case-report/<case-id>
```

```json
{
  "title": "Initial Case Report",
  "summary": "Summary of findings and recommended next steps.",
  "generatedBy": "Justice Desk Legal Team"
}
```

Create a lawyer note with:

```http
POST /api/v1/lawyer-note/<case-id>
```

```json
{
  "title": "Private case note",
  "content": "Follow up with the client about the evidence.",
  "isPrivate": true
}
```

Legal documents associate automatically with the lawyer assigned to the case, regardless of whether the uploader is the client or lawyer. Reports associate with the authenticated lawyer who creates them. Private lawyer notes are available to authorized case participants according to the route authorization rules.

### 6. Invoices and payments

Lawyers or administrators create invoices for a case with the invoice route. Clients can view their invoices and pay according to the configured payment flow. Invoice status values include `UNPAID`, `PAID`, `PARTIALLY_PAID`, `OVERDUE`, and `CANCELLED`.

## Main Route Groups

All routes are prefixed with `/api/v1`:

- `/auth` - registration, verification, login, refresh, logout, password reset, and current user
- `/user` - user profile operations
- `/lawyer` - lawyer applications, approval, profiles, and management
- `/specialization` - legal specialization management
- `/schedule` - lawyer availability and schedule capacity
- `/appointment` - booking, payment, status, joining, and webhooks
- `/case` - case creation, assignment, status, and access
- `/legal-document` - case document uploads and management
- `/case-activity` - case timeline activities
- `/case-message` - case collaboration messages
- `/case-report` - generated case reports
- `/invoice` - case invoices and payment status
- `/lawyer-note` - lawyer case notes
- `/payment` - payment history and payment records

The Postman collection in `Justice-Desk.postman_collection.json` contains request examples and environment variables for these workflows.

## Validation and Quality Checks

```bash
npm run build
npm run lint:check
npm run format:check
```

Automatic formatting and lint fixes can be run with:

```bash
npm run format:fix
npm run lint:fix
```

The repository currently reports existing Biome diagnostics in parts of the codebase. TypeScript compilation is the primary build check and should pass before running the server.

## Project Structure

```text
prisma/
  schema/       Prisma schema files
  migrations/   Database migrations
  generated/    Generated Prisma client
src/
  app.ts        Express application and route mounting
  server.ts     Startup, service checks, seeding, and HTTP listener
  app/
    config/     Environment configuration
    lib/        Prisma, Redis, mail, storage, payment, and auth integrations
    middleware/ Authentication, validation, errors, and 404 handling
    module/     Feature modules and route/controller/service layers
    utils/      Shared errors, JWT, responses, async handling, and seed logic
scripts/
  dev.ts        Development API and Stripe webhook launcher
```

## API Response and Error Handling

Successful requests use the shared response helper. Invalid request bodies are rejected by Zod validation with HTTP `400`. Protected endpoints require a valid bearer token and role authorization. Unknown routes are handled by the not-found middleware, and application errors are handled by the global error middleware.

## Payments and Webhooks

For local Stripe testing, log in to the Stripe CLI and run:

```bash
stripe listen --forward-to localhost:5000/api/v1/appointment/stripe/webhook
```

The `npm run dev` script starts this forwarding process automatically, but the Stripe CLI must be installed and authenticated first.
