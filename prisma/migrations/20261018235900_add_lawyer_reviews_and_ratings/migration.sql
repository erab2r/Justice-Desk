ALTER TABLE "lawyers"
ADD COLUMN "average_rating" DECIMAL(3, 2) NOT NULL DEFAULT 4.0,
ADD COLUMN "rating_count" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "lawyer_reviews" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review_comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,

    CONSTRAINT "lawyer_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "lawyer_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unique_lawyer_review_user_lawyer"
ON "lawyer_reviews"("user_id", "lawyer_id");

CREATE INDEX "idx_lawyer_review_lawyer_created_at"
ON "lawyer_reviews"("lawyer_id", "created_at");

ALTER TABLE "lawyer_reviews"
ADD CONSTRAINT "lawyer_reviews_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lawyer_reviews"
ADD CONSTRAINT "lawyer_reviews_lawyer_id_fkey"
FOREIGN KEY ("lawyer_id") REFERENCES "lawyers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
