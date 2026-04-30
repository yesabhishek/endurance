import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const dbPath = sqlitePath(databaseUrl);

mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");

db.exec(`
CREATE TABLE IF NOT EXISTS "ConnectedAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "accountEmail" TEXT,
  "displayName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "scope" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConnectedAccount_provider_accountEmail_key" ON "ConnectedAccount"("provider", "accountEmail");
CREATE INDEX IF NOT EXISTS "ConnectedAccount_provider_idx" ON "ConnectedAccount"("provider");

CREATE TABLE IF NOT EXISTS "SyncCursor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "cursorType" TEXT NOT NULL,
  "lastMessageAt" DATETIME,
  "lastMessageId" TEXT,
  "lastHistoryId" TEXT,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncCursor_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SyncCursor_source_connectedAccountId_key" ON "SyncCursor"("source", "connectedAccountId");
CREATE INDEX IF NOT EXISTS "SyncCursor_source_updatedAt_idx" ON "SyncCursor"("source", "updatedAt");
CREATE INDEX IF NOT EXISTS "SyncCursor_connectedAccountId_idx" ON "SyncCursor"("connectedAccountId");

CREATE TABLE IF NOT EXISTS "OAuthToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "connectedAccountId" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "expiryDate" DATETIME,
  "scope" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthToken_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OAuthToken_connectedAccountId_idx" ON "OAuthToken"("connectedAccountId");

CREATE TABLE IF NOT EXISTS "SyncRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "connectedAccountId" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "scanned" INTEGER NOT NULL DEFAULT 0,
  "inserted" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  CONSTRAINT "SyncRun_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SyncRun_source_startedAt_idx" ON "SyncRun"("source", "startedAt");

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "syncRunId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNREAD',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" DATETIME,
  CONSTRAINT "Notification_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_source_createdAt_idx" ON "Notification"("source", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_syncRunId_idx" ON "Notification"("syncRunId");

CREATE TABLE IF NOT EXISTS "EmailSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "gmailMessageId" TEXT NOT NULL,
  "gmailThreadId" TEXT,
  "accountEmail" TEXT,
  "sentAt" DATETIME NOT NULL,
  "fromAddress" TEXT,
  "fromName" TEXT,
  "subject" TEXT NOT NULL,
  "snippet" TEXT,
  "labelsJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailSource_gmailMessageId_key" ON "EmailSource"("gmailMessageId");
CREATE INDEX IF NOT EXISTS "EmailSource_sentAt_idx" ON "EmailSource"("sentAt");
CREATE INDEX IF NOT EXISTS "EmailSource_accountEmail_idx" ON "EmailSource"("accountEmail");

CREATE TABLE IF NOT EXISTS "ParsedFinancialEmail" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "emailSourceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amount" DECIMAL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "merchantName" TEXT,
  "paymentInstrument" TEXT,
  "category" TEXT,
  "confidence" REAL NOT NULL DEFAULT 0,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParsedFinancialEmail_emailSourceId_fkey" FOREIGN KEY ("emailSourceId") REFERENCES "EmailSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ParsedFinancialEmail_kind_idx" ON "ParsedFinancialEmail"("kind");

CREATE TABLE IF NOT EXISTS "Merchant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "category" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Merchant_name_key" ON "Merchant"("name");

CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "emailSourceId" TEXT,
  "merchantId" TEXT,
  "externalId" TEXT,
  "amount" DECIMAL NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "transactionDate" DATETIME NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'DEBIT',
  "category" TEXT,
  "paymentInstrument" TEXT,
  "description" TEXT,
  "confidence" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_emailSourceId_fkey" FOREIGN KEY ("emailSourceId") REFERENCES "EmailSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_externalId_key" ON "Transaction"("externalId");
CREATE INDEX IF NOT EXISTS "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");
CREATE INDEX IF NOT EXISTS "Transaction_merchantId_idx" ON "Transaction"("merchantId");

CREATE TABLE IF NOT EXISTS "RecurringPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "merchantId" TEXT NOT NULL,
  "amount" DECIMAL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "cadence" TEXT NOT NULL DEFAULT 'monthly',
  "nextDueDate" DATETIME,
  "lastSeenAt" DATETIME NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'gmail',
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringPayment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "RecurringPayment_merchantId_cadence_key" ON "RecurringPayment"("merchantId", "cadence");

CREATE TABLE IF NOT EXISTS "InvestmentAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "accountName" TEXT,
  "accountRef" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "InvestmentAccount_provider_accountRef_key" ON "InvestmentAccount"("provider", "accountRef");

CREATE TABLE IF NOT EXISTS "Holding" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "assetClass" TEXT NOT NULL,
  "symbol" TEXT,
  "isin" TEXT,
  "name" TEXT NOT NULL,
  "exchange" TEXT,
  "quantity" DECIMAL NOT NULL DEFAULT 0,
  "averagePrice" DECIMAL,
  "lastPrice" DECIMAL,
  "currentValue" DECIMAL,
  "pnl" DECIMAL,
  "pnlPct" DECIMAL,
  "asOf" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataJson" TEXT,
  CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Holding_accountId_source_assetClass_name_symbol_key" ON "Holding"("accountId", "source", "assetClass", "name", "symbol");
CREATE INDEX IF NOT EXISTS "Holding_assetClass_idx" ON "Holding"("assetClass");

CREATE TABLE IF NOT EXISTS "InvestmentSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "holdingId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quantity" DECIMAL NOT NULL DEFAULT 0,
  "price" DECIMAL,
  "value" DECIMAL,
  "pnl" DECIMAL,
  "metadataJson" TEXT,
  CONSTRAINT "InvestmentSnapshot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "InvestmentSnapshot_capturedAt_idx" ON "InvestmentSnapshot"("capturedAt");

CREATE TABLE IF NOT EXISTS "ChatThread" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL DEFAULT 'Finance chat',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "threadId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");
`);

db.close();
console.log(`SQLite schema ready at ${dbPath}`);

function sqlitePath(url) {
  if (!url.startsWith("file:")) {
    throw new Error(`Only SQLite file: URLs are supported by this initializer. Received ${url}`);
  }

  const raw = url.slice("file:".length);
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(process.cwd(), "prisma", raw);
}
