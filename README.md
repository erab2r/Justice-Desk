# Justice Desk

> Lawyer consultation, appointment scheduling, payment, and legal case-management API.

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

- Node.js 20 or newer
- PostgreSQL
- Redis
- Cloudinary, SMTP, Stripe, and bKash credentials for the related features
- Stripe CLI only when testing Stripe webhooks locally

## Installation

```bash
npm install
```

Copy `.env.example` to `.env` and replace the placeholders with local or hosted service credentials:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The application reads these variables from `.env`:

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
GOOGLE_GENERATIVE_AI_API_KEY=replace-me
GOOGLE_GEMINI_HIGH_MODEL=gemini-flash-lite-latest
GOOGLE_GEMINI_LOW_MODEL=gemini-flash-latest

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
npx prisma migrate deploy
```

For local development, create a new migration after changing the schema:

```bash
npx prisma migrate dev --name describe_your_change
```

Never use `prisma migrate reset` against a database containing data. Production and shared environments should use committed migrations with `prisma migrate deploy`.

The server connects to PostgreSQL, Redis, and SMTP during startup. It also seeds the configured super-admin, tester-admin, and tester-lawyer accounts when the relevant environment variables are present.

## Running the API

Development mode starts the API with watch mode:

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

The server startup sequence connects to PostgreSQL, Redis, and SMTP, runs the configured seed helpers, removes expired unverified lawyer applications, and then starts the HTTP listener.

The default base URL is:

```text
http://localhost:5000/api/v1
```

## AI legal intake and document review

Gemini is called only by the API server. Configure `GOOGLE_GENERATIVE_AI_API_KEY`
in the server environment; never expose it through a `NEXT_PUBLIC_` variable or
browser code. The server tries `GOOGLE_GEMINI_HIGH_MODEL` first and falls back
to `GOOGLE_GEMINI_LOW_MODEL` if that model is unavailable or fails. The defaults
are `gemini-3.1-pro-preview` and `gemini-3.8-flash`; both model names can be
changed in the server environment without a code change. The defaults avoid
Pro models and prefer Flash Lite for free-tier development; free-tier access,
quota, and service availability are controlled by Google and are not guaranteed
for every project or at all times.

- `POST /ai/intake` accepts `{ "prompt": "..." }` and returns a preliminary
  legal-intake summary, likely practice area, urgency, issues, next steps, and
  questions for an advocate.
- `POST /ai/analyze-document` accepts `documentName`, `documentType`, and
  pasted `documentText`, and returns a preliminary clause review. It does not
  fetch document URLs or extract text from uploaded files.

Both endpoints are currently public, matching the public intake and demo
document-review UI. Apply appropriate rate limits and privacy/consent controls
before production use; request text is sent to Google Gemini for processing.
AI output is not legal advice.

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

## Roles and authorization

The API uses JWT access tokens. Send a token on protected requests using either:

```http
Authorization: Bearer <access-token>
```

or the `accessToken` cookie.

Available roles:

| Role | Responsibility |
| --- | --- |
| `SUPER_ADMIN` | Full administrative access |
| `ADMIN` | Administrative management of lawyers, specializations, cases, and payments |
| `LAWYER` | Lawyer profile, availability, assigned cases, documents, and appointments |
| `CLIENT` | Client profile, appointments, cases, documents, and payments |

Blocked or deleted users cannot use protected endpoints. Most lawyer and case resources also enforce ownership or assignment checks in the service layer.

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

## Lawyer management

The lawyer module supports both public discovery and administrative management.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/lawyer/apply-lw` | Public, multipart | Submit a lawyer application with `resume`, `additionalFiles`, and JSON `user`/`lawyer` fields |
| `POST` | `/lawyer/verify-email` | Public | Verify an application email |
| `PATCH` | `/lawyer/approve-lw` | Admin, Super Admin | Approve or reject the lawyer application |
| `GET` | `/lawyer/all-lawyers` | Admin, Super Admin | Paginated lawyer administration list |
| `PATCH` | `/lawyer/profile` | Lawyer | Edit the authenticated lawyer's profile |
| `PATCH` | `/lawyer/:lawyerId/profile` | Lawyer owner, Admin, Super Admin | Edit a specific lawyer profile |
| `PATCH` | `/lawyer/:lawyerId/status` | Admin, Super Admin | Activate or deactivate a lawyer |
| `PATCH` | `/lawyer/:lawyerId/suspension` | Admin, Super Admin | Suspend or unsuspend an approved lawyer |
| `DELETE` | `/lawyer/:lawyerId` | Admin, Super Admin | Soft-delete a lawyer and related account access |
| `GET` | `/lawyer/:lawyerId/documents` | Lawyer owner, Admin, Super Admin | List lawyer application documents |
| `PATCH` | `/lawyer/:lawyerId/documents` | Lawyer owner, Admin, Super Admin | Upload or replace resume/additional files |
| `DELETE` | `/lawyer/:lawyerId/documents` | Lawyer owner, Admin, Super Admin | Delete a resume or additional file |
| `GET` | `/lawyer/all-lw` | Public | List active approved lawyers |
| `GET` | `/lawyer/:lawyerId` | Public | View an active approved lawyer profile, contact details, rating aggregate, reviews, and future published schedules with available capacity |
| `POST` | `/lawyer/reviews` | Client | Submit one rating/review after a completed or past confirmed appointment with the lawyer |
| `GET` | `/lawyer/reviews/my` | Client | List the authenticated client's submitted lawyer reviews |

`DELETE /lawyer/:lawyerId` is a soft delete. It preserves historical case and appointment records while preventing future access.

Lawyer review submissions require a body containing `rating` (an integer from 1 to 5), `review_comment`, `user_id`, and `lawyer_id`. The authenticated client's `user_id` must match the token, and the client must have a completed appointment or a confirmed appointment whose scheduled end time has passed. A client can submit at most one review per lawyer. Lawyer aggregates start at `averageRating: 4.0` and `ratingCount: 1`; each accepted review updates both values transactionally.

## Specialization and practice-area approval

Existing specializations selected during a lawyer application are assigned directly to the lawyer. A genuinely new `newPracticeArea` is stored on a pending specialization request and is not inserted into the public specialization list immediately.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/specialization` | Public | List usable specializations |
| `POST` | `/specialization` | Admin, Super Admin | Create an admin-managed specialization |
| `PATCH` | `/specialization/:specializationId` | Admin, Super Admin | Update a specialization |
| `DELETE` | `/specialization/:specializationId` | Admin, Super Admin | Delete a specialization |
| `POST` | `/specialization/requests` | Lawyer | Request an existing specialization or submit `newPracticeArea` |
| `GET` | `/specialization/requests` | Admin, Super Admin | List specialization requests |
| `PATCH` | `/specialization/requests/review` | Admin, Super Admin | Approve or reject a specialization request |
| `GET` | `/specialization/me` | Lawyer | List the authenticated lawyer's approved specializations |
| `DELETE` | `/specialization/me/:specializationId` | Lawyer | Remove an approved specialization |
| `GET` | `/specialization/lawyer/:lawyerId` | Public | View a lawyer's approved specializations |

For a new practice area, approval creates the `Specialization` row and the `LawyerSpecialization` assignment in one transaction. Rejection removes only the pending request.

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
.
├── prisma/
│   ├── schema/                 # Split Prisma schema files
│   │   ├── schema.prisma       # Generator and datasource configuration
│   │   ├── enums.prisma        # Shared enums
│   │   └── *.prisma            # Domain models and relations
│   ├── migrations/             # Versioned database migrations
│   └── generated/prisma/       # Generated Prisma 7 client (do not edit manually)
├── src/
│   ├── app.ts                  # Express app and route mounting
│   ├── server.ts               # Startup, connections, seeding, and HTTP listener
│   └── app/
│       ├── config/             # Environment configuration
│       ├── interfaces/         # Shared request/query types
│       ├── lib/                # Prisma, Redis, mail, storage, and payments
│       ├── middleware/         # Auth, validation, errors, and 404 handling
│       ├── module/             # Feature modules
│       │   └── <feature>/
│       │       ├── *.route.ts       # Route definitions and role guards
│       │       ├── *.controller.ts  # HTTP request/response handling
│       │       ├── *.service.ts     # Business logic and Prisma operations
│       │       ├── *.validation.ts  # Zod schemas
│       │       └── *.interface.ts   # Feature-specific types
│       ├── templates/           # Email templates
│       ├── utils/               # Errors, JWT, responses, async helpers, and seeds
├── .env.example                # Environment variable template
├── prisma7.config.ts           # Prisma 7 configuration
├── tsup.config.ts              # Build configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Scripts and dependencies
```

Each feature module follows the route → controller → service pattern. Controllers should remain thin; authorization, validation-sensitive business rules, transactions, and Prisma queries belong in services.

## API Response and Error Handling

Successful requests use the shared response helper. Invalid request bodies are rejected by Zod validation with HTTP `400`. Protected endpoints require a valid bearer token and role authorization. Unknown routes are handled by the not-found middleware, and application errors are handled by the global error middleware.

## Payments and Webhooks

For local Stripe testing, log in to the Stripe CLI and run:

```bash
stripe listen --forward-to localhost:5000/api/v1/appointment/stripe/webhook
```

Run this in a separate terminal; `npm run dev` only starts the API watcher. The Stripe CLI must be installed and authenticated first.
