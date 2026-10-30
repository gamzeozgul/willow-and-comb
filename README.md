# Willow & Comb

A one-page booking site for a fictional Austin hair studio. The customer picks a service and a time. The owner works in a Google Sheet. n8n sends the mail.

No accounts, payments, or chat. English only.

## How it fits

```mermaid
flowchart LR
  customer[Customer page] --> sheet[Google Sheet]
  sheet --> notify[Notify the salon]
  sheet --> remind[Remind tomorrow]
  sheet --> review[Ask for a review]
  notify --> owner[Owner inbox]
  remind --> guest[Customer]
  review --> guest
  notify -.->|on failure| alarm[Report a failure]
  remind -.-> alarm
  review -.-> alarm
  alarm --> owner
```

The page is a Google Apps Script web app. It stays up when the computer is off. n8n is the free local edition, so mail goes out only while this computer is on.

Live page: https://script.google.com/macros/s/AKfycbyviDGh6xAi4F-o-XeS1zOkYGCVQnEBQFaBDFRJfEwJ7W0mcU-HwvRrwPE0vAC6S6ZB/exec

## Sheet

Three tabs: Services, Settings, Bookings. Hours, prices, the salon email, and the mail times live in the sheet, not in code. Seed rows are in `src/sheetContract.js`.

Cancel a booking by setting `status` to `cancelled`. Stop customer mail by setting `email_opt_out` to `yes`. The salon still hears about that booking.

## Workflows

Start n8n with `n8n start`, then open http://localhost:5678. Leave these on:

| Workflow | When | What |
| --- | --- | --- |
| Notify the salon | Every 5 minutes | Emails the salon about a new confirmed booking, then writes `owner_notified_at` |
| Remind tomorrow | 08:00 America/Chicago | Emails tomorrow's customers, then writes `reminder_sent_at` |
| Ask for a review | 19:30 America/Chicago | Emails customers whose visit already ended today, then writes `review_sent_at` |

Leave these off:

- **Report a failure.** n8n calls it when one of the three fails. It does not need to be on.
- **Break on purpose.** A test that throws. Turning it on sends a fake failure mail every minute.

Customer mail includes a cancel line and `To stop these emails, reply STOP.` The salon mail does not. There is no confirmation mail.

Import files are in `n8n/`. Connect the demo Google account. The spreadsheet id is the part of the sheet URL between `/d/` and `/edit`.

## Checks

```bash
npm test
```

By hand:

1. Book an open time. A confirmed row appears. Within a few minutes the salon gets one mail and `owner_notified_at` fills. Run it again and the same row is quiet.
2. Book that same time again. The page says it was just taken.
3. Monday, the past, the next two hours, and a service that would end after close are not offered.
4. A booking for tomorrow gets one reminder. `email_opt_out` = `yes`, or `status` = `cancelled`, gets none.
5. A visit that already ended today gets one review mail. Tomorrow's visit does not.
6. A failed scheduled run mails the demo inbox with the workflow name and the node. Clicking Execute in the editor does not.

## Decisions

n8n polls the sheet. There is no public webhook. The page takes a lock and checks the slot again before it writes, so two people cannot take the same time. "Tomorrow" and the two daily mails use America/Chicago, including the clock change. Sent times are stored on the row, so a mail is not sent twice.

## Known limits

- Salon mail can lag a few minutes, and only while local n8n is running.
- The 08:00 reminder and the 19:30 review do not catch up if the computer was off.
- The form enforces the rules. A row typed straight into the sheet is trusted.
- A STOP reply is not read. The owner marks the sheet.
- Date columns must stay plain text. A localized date is misread.
- The free Apps Script page shows Google's "created by" banner.
