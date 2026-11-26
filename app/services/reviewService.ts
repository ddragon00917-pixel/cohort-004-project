import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import { reviews, users } from "~/db/schema";
import { MAX_REVIEW_LENGTH, MIN_REVIEW_LENGTH } from "~/lib/review";

// ─── Review Service ───
// Handles course reviews written by enrolled students.
// A student may leave at most one review per course and can edit or delete it.

export type CourseRating = { average: number; count: number };

function assertValidRating(rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be a whole number between 1 and 5.");
  }
}

function assertValidContent(content: string) {
  const length = content.trim().length;
  if (length < MIN_REVIEW_LENGTH || length > MAX_REVIEW_LENGTH) {
    throw new Error(
      `Review must be between ${MIN_REVIEW_LENGTH} and ${MAX_REVIEW_LENGTH} characters.`
    );
  }
}

export function getUserReviewForCourse(userId: number, courseId: number) {
  return db
    .select()
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.courseId, courseId)))
    .get();
}

export function createReview(
  userId: number,
  courseId: number,
  rating: number,
  content: string
) {
  assertValidRating(rating);
  assertValidContent(content);

  if (getUserReviewForCourse(userId, courseId)) {
    throw new Error("You've already reviewed this course.");
  }

  return db
    .insert(reviews)
    .values({ userId, courseId, rating, content: content.trim() })
    .returning()
    .get();
}

export function updateReview(
  reviewId: number,
  userId: number,
  rating: number,
  content: string
) {
  assertValidRating(rating);
  assertValidContent(content);

  return db
    .update(reviews)
    .set({
      rating,
      content: content.trim(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
    .returning()
    .get();
}

export function deleteReview(reviewId: number, userId: number) {
  return db
    .delete(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
    .returning()
    .get();
}

export function getReviewsForCourse(courseId: number) {
  return db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
      rating: reviews.rating,
      content: reviews.content,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.courseId, courseId))
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .all();
}

function toCourseRating(
  row: { average: number | null; count: number } | undefined
): CourseRating {
  return {
    average: row?.average ? Math.round(row.average * 10) / 10 : 0,
    count: row?.count ?? 0,
  };
}

export function getCourseRating(courseId: number): CourseRating {
  const row = db
    .select({
      average: sql<number>`avg(${reviews.rating})`,
      count: sql<number>`count(${reviews.id})`,
    })
    .from(reviews)
    .where(eq(reviews.courseId, courseId))
    .get();

  return toCourseRating(row);
}

/** Batch lookup for course cards — avoids one query per course. */
export function getCourseRatings(courseIds: number[]): Map<number, CourseRating> {
  if (courseIds.length === 0) return new Map();

  const rows = db
    .select({
      courseId: reviews.courseId,
      average: sql<number>`avg(${reviews.rating})`,
      count: sql<number>`count(${reviews.id})`,
    })
    .from(reviews)
    .where(inArray(reviews.courseId, courseIds))
    .groupBy(reviews.courseId)
    .all();

  return new Map(
    rows.map((row) => [row.courseId, toCourseRating(row)])
  );
}
