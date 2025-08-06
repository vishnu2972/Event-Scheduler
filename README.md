# Advanced Event Scheduler API (NestJS)

This is a NestJS API for scheduling events with optional reminders and recurrence (daily, weekly, none).

## 🚀 Features

- Create events with:
  - Title
  - Start time / End time
  - Optional reminder (in minutes)
  - Recurrence: none, daily, weekly
- Validations:
  - No overlapping/conflicting events
  - Reminder < Start Time
- Fetch today's events (with recurrence logic)
- JSON file-based storage

## 📦 Setup

```bash
npm install
npm run start
```

## 📬 API Endpoints

### Create Event

`POST /events`

```json
{
  "title": "Team Meeting",
  "startTime": "2025-08-05T14:00:00Z",
  "endTime": "2025-08-05T15:00:00Z",
  "recurrence": "none",
  "reminderMinutes": 30
}
```
To ensure reminders are set before the event start time, the 'reminderMinutes' attribute accepts
only a positive integer between 0-60. This ensures that the reminder can only be few minutes before start.
This value represents the number of minutes before the event's start time when the reminder should trigger.

### Get Today’s Events

`GET /events/today`

## 🧪 Run Tests

```bash
npm run test
```
This command runs the test cases defined in src/test/events.service.spec.ts.

## 📁 Data

All created events are saved to `events.json` file.
