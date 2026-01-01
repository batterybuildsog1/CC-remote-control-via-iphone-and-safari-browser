import { pgTable, text, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  status: text('status').notNull().default('running'), // running, pending, completed, error
  currentTask: text('current_task'),
  projectId: text('project_id'), // Which project/repo this agent is working on
  terminalId: text('terminal_id'), // Unique terminal identifier
  logs: jsonb('logs').$type<Array<{ timestamp: string; message: string; level: string }>>().default([]),
  pendingDiff: jsonb('pending_diff').$type<{
    filename: string;
    previous: string;
    current: string;
  } | null>(),
  approvalResponse: text('approval_response'), // 'approved', 'rejected', or feedback text
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type AgentRecord = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
