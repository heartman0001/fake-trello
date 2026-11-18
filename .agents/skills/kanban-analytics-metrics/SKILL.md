---
name: kanban-analytics-metrics
description: SQL aggregation and Kanban flow metrics definitions (Cycle Time, Lead Time, WIP, Throughput). Use when building board analytics, reports, or SQL queries for project insights.
---

# Kanban Analytics & SQL Aggregation Rules

## 1. Core Kanban Flow Definitions
- **Lead Time:** Measure duration from `Card.createdAt` to the timestamp the card entered the designated "Done" column in `ActivityLog`.
- **Cycle Time:** Measure duration from when a card leaves the initial backlog/to-do column ("In Progress" start) until it enters the "Done" column.
- **Work In Progress (WIP):** Count active cards currently residing in non-initial and non-completed columns.
- **Throughput:** Count cards moved into the "Done" column per week or sprint period.

## 2. PostgreSQL Performance Rules
- Perform heavy date-diff calculations, percentiles (p50, p85, p95), and groupings directly in PostgreSQL using `CTE` (Common Table Expressions) and window functions (`LAG()`, `LEAD()`, `PERCENTILE_CONT()`).
- Never fetch all raw `ActivityLog` rows into NestJS application memory to compute analytics.