-- Park-office staff: EMPLOYEE users scoped to an industrial park (not a factory).
ALTER TABLE "User" ADD COLUMN "employeeOfParkId" TEXT;

CREATE INDEX "User_employeeOfParkId_idx" ON "User"("employeeOfParkId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_employeeOfParkId_fkey"
  FOREIGN KEY ("employeeOfParkId") REFERENCES "IndustrialPark"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
