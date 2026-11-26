import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  createReview,
  updateReview,
  deleteReview,
  getUserReviewForCourse,
  getReviewsForCourse,
  getCourseRating,
  getCourseRatings,
} from "./reviewService";

function createStudent(name: string, email: string) {
  return testDb
    .insert(schema.users)
    .values({ name, email, role: schema.UserRole.Student })
    .returning()
    .get();
}

function createSecondCourse() {
  return testDb
    .insert(schema.courses)
    .values({
      title: "Another Course",
      slug: "another-course",
      description: "Another test course",
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
}

describe("reviewService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createReview", () => {
    it("stores the rating and trimmed content", () => {
      const review = createReview(base.user.id, base.course.id, 5, "  Great course!  ");

      expect(review.userId).toBe(base.user.id);
      expect(review.courseId).toBe(base.course.id);
      expect(review.rating).toBe(5);
      expect(review.content).toBe("Great course!");
      expect(review.createdAt).toBeTruthy();
      expect(review.updatedAt).toBeTruthy();
    });

    it("rejects ratings outside 1-5", () => {
      expect(() => createReview(base.user.id, base.course.id, 0, "Not great at all")).toThrow(
        /between 1 and 5/
      );
      expect(() => createReview(base.user.id, base.course.id, 6, "Not great at all")).toThrow(
        /between 1 and 5/
      );
      expect(() => createReview(base.user.id, base.course.id, 2.5, "Not great at all")).toThrow(
        /between 1 and 5/
      );
    });

    it("rejects content that is too short or too long", () => {
      expect(() => createReview(base.user.id, base.course.id, 5, "short")).toThrow(
        /between 10 and 1000/
      );
      expect(() => createReview(base.user.id, base.course.id, 5, "x".repeat(1001))).toThrow(
        /between 10 and 1000/
      );
    });

    it("does not allow more than one review per user and course", () => {
      createReview(base.user.id, base.course.id, 4, "Really solid course");

      expect(() =>
        createReview(base.user.id, base.course.id, 2, "Changed my mind about it")
      ).toThrow(/already reviewed/);
      expect(getReviewsForCourse(base.course.id)).toHaveLength(1);
    });

    it("allows different users to review the same course", () => {
      const second = createStudent("Second Student", "second@example.com");
      createReview(base.user.id, base.course.id, 5, "Excellent, very clear lessons");
      createReview(second.id, base.course.id, 3, "Decent course, could be longer");

      expect(getReviewsForCourse(base.course.id)).toHaveLength(2);
    });

    it("allows the same user to review different courses", () => {
      const otherCourse = createSecondCourse();
      createReview(base.user.id, base.course.id, 5, "Excellent, very clear lessons");
      createReview(base.user.id, otherCourse.id, 4, "Really solid course overall");

      expect(getReviewsForCourse(base.course.id)).toHaveLength(1);
      expect(getReviewsForCourse(otherCourse.id)).toHaveLength(1);
    });
  });

  describe("getUserReviewForCourse", () => {
    it("returns the user's own review only", () => {
      const other = createStudent("Other Student", "other@example.com");
      const review = createReview(base.user.id, base.course.id, 4, "Really solid course");
      createReview(other.id, base.course.id, 2, "Not quite what I expected");

      expect(getUserReviewForCourse(base.user.id, base.course.id)?.id).toBe(review.id);
      expect(getUserReviewForCourse(999, base.course.id)).toBeUndefined();
    });
  });

  describe("updateReview", () => {
    it("updates rating and content", () => {
      const review = createReview(base.user.id, base.course.id, 2, "Not quite what I expected");
      const updated = updateReview(review.id, base.user.id, 5, "Actually really great course");

      expect(updated?.rating).toBe(5);
      expect(updated?.content).toBe("Actually really great course");
      expect(getUserReviewForCourse(base.user.id, base.course.id)?.rating).toBe(5);
    });

    it("does not update another user's review", () => {
      const other = createStudent("Other Student", "other@example.com");
      const review = createReview(base.user.id, base.course.id, 4, "Really solid course");

      expect(updateReview(review.id, other.id, 1, "Hijacking this review text")).toBeUndefined();
      expect(getUserReviewForCourse(base.user.id, base.course.id)?.rating).toBe(4);
    });
  });

  describe("deleteReview", () => {
    it("removes the review", () => {
      const review = createReview(base.user.id, base.course.id, 4, "Really solid course");

      expect(deleteReview(review.id, base.user.id)?.id).toBe(review.id);
      expect(getReviewsForCourse(base.course.id)).toHaveLength(0);
    });

    it("does not delete another user's review", () => {
      const other = createStudent("Other Student", "other@example.com");
      const review = createReview(base.user.id, base.course.id, 4, "Really solid course");

      expect(deleteReview(review.id, other.id)).toBeUndefined();
      expect(getReviewsForCourse(base.course.id)).toHaveLength(1);
    });
  });

  describe("getReviewsForCourse", () => {
    it("includes reviewer names and avatars and excludes other courses", () => {
      const otherCourse = createSecondCourse();
      createReview(base.user.id, base.course.id, 5, "Excellent, very clear lessons");
      createReview(base.user.id, otherCourse.id, 4, "Really solid course overall");

      const reviews = getReviewsForCourse(base.course.id);

      expect(reviews).toHaveLength(1);
      expect(reviews[0].userName).toBe("Test User");
      expect(reviews[0].userAvatarUrl).toBeNull();
      expect(reviews[0].content).toBe("Excellent, very clear lessons");
    });

    it("orders reviews newest first", () => {
      const other = createStudent("Other Student", "other@example.com");
      testDb.insert(schema.reviews).values({
        userId: base.user.id,
        courseId: base.course.id,
        rating: 5,
        content: "An older review of this course",
        createdAt: "2020-01-01T00:00:00.000Z",
      }).run();
      testDb.insert(schema.reviews).values({
        userId: other.id,
        courseId: base.course.id,
        rating: 4,
        content: "A newer review of this course",
        createdAt: "2025-01-01T00:00:00.000Z",
      }).run();

      const reviews = getReviewsForCourse(base.course.id);
      expect(reviews[0].content).toBe("A newer review of this course");
      expect(reviews[1].content).toBe("An older review of this course");
    });
  });

  describe("rating summaries", () => {
    it("returns zero for a course with no reviews", () => {
      expect(getCourseRating(base.course.id)).toEqual({ average: 0, count: 0 });
    });

    it("computes the average rounded to one decimal", () => {
      const other = createStudent("Other Student", "other@example.com");
      createReview(base.user.id, base.course.id, 5, "Excellent, very clear lessons");
      createReview(other.id, base.course.id, 4, "Really solid course overall");

      expect(getCourseRating(base.course.id)).toEqual({ average: 4.5, count: 2 });
    });

    it("gets ratings for several courses in one map", () => {
      const otherCourse = createSecondCourse();
      const other = createStudent("Other Student", "other@example.com");
      createReview(base.user.id, base.course.id, 5, "Excellent, very clear lessons");
      createReview(other.id, otherCourse.id, 3, "Decent course, could be longer");

      const ratings = getCourseRatings([base.course.id, otherCourse.id]);
      expect(ratings.get(base.course.id)).toEqual({ average: 5, count: 1 });
      expect(ratings.get(otherCourse.id)).toEqual({ average: 3, count: 1 });
    });

    it("returns an empty map when given no course ids", () => {
      expect(getCourseRatings([]).size).toBe(0);
    });
  });
});
