# Instagram Frontend

This project is a Vite-powered Vue 3 client for an Instagram-style social app.
The client communicates with a JSON API exposed by the backend running on
`http://localhost:3000`.

## Notifications domain

- `src/models/Notification.js` represents the notification entity used by the
  UI. It converts incoming message payloads into first-class notification
  objects that can be shared across components.
- `src/controllers/NotificationController.js` coordinates notification state,
  timers, and lifecycle hooks so individual views can stay presentation focused.
- `src/views/Inbox.vue` now consumes these modules, which keeps component logic
  lean while making the notification flow easier to test and reuse.

### Database changes

No migrations are performed in this frontend repository, but the backend must
persist notifications as a separate resource. Introduce (or ensure existence of)
a `notifications` table with the following shape:

- `id` – primary key
- `user_id` – recipient of the notification (`references users`)
- `message_id` – the message that triggered the notification (`references messages`)
- `preview` – cached preview text for fast display
- `read_at` – nullable timestamp indicating when the notification was cleared
- `created_at` / `updated_at`

Add indexes on `user_id` and `read_at` to make unread lookups fast. If you
already store notification-like data elsewhere, migrate it into this dedicated
table so the frontend’s notification model stays in sync with a single source of
truth.
