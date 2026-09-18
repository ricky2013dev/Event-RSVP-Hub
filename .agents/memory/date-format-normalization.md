---
name: API date format normalization
description: OpenAPI date fields may arrive through the generated client as ISO timestamps rather than bare calendar strings.
---

When rendering calendar-only values from generated API clients, normalize to the first 10 characters before constructing a local noon date.

**Why:** The generated client/runtime can deserialize an OpenAPI `format: date` response as an ISO timestamp, which makes naive `${value}T12:00:00` parsing invalid.

**How to apply:** Use a defensive formatter that accepts both `YYYY-MM-DD` and ISO date-time strings at UI boundaries.