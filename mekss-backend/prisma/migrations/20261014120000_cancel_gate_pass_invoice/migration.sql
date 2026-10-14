-- Gate passes can be withdrawn before exit; invoice cancellations get their own adjustment type.
ALTER TYPE "GatePassStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "InvoiceAdjustmentType" ADD VALUE IF NOT EXISTS 'CANCELLATION';
