-- Prevent industrial-park deletion from cascading or detaching durable business records.
-- Existing rows are preserved; only foreign-key delete actions are hardened.
BEGIN;

ALTER TABLE "Announcement"
  DROP CONSTRAINT "Announcement_parkId_fkey",
  ADD CONSTRAINT "Announcement_parkId_fkey"
    FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Advertisement"
  DROP CONSTRAINT "Advertisement_parkId_fkey",
  ADD CONSTRAINT "Advertisement_parkId_fkey"
    FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SecurityGuard"
  DROP CONSTRAINT "SecurityGuard_parkId_fkey",
  ADD CONSTRAINT "SecurityGuard_parkId_fkey"
    FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legacy recipientParkId values were previously unconstrained. NOT VALID preserves any
-- historical orphan while enforcing the relation for all new writes and park deletes.
ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_recipientParkId_fkey"
    FOREIGN KEY ("recipientParkId") REFERENCES "IndustrialPark"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

COMMIT;
