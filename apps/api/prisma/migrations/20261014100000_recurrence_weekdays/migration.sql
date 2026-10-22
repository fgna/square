-- Recurring events on weekdays only (Monday to Friday).
ALTER TYPE "RecurrenceRule" ADD VALUE IF NOT EXISTS 'WEEKDAYS';
