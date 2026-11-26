import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { UserAvatar } from "~/components/user-avatar";
import { MAX_REVIEW_LENGTH, MIN_REVIEW_LENGTH } from "~/lib/review";

export type CourseRating = { average: number; count: number };

export type CourseReview = {
  id: number;
  userId: number;
  userName: string;
  userAvatarUrl: string | null;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type ReviewActionData = {
  success?: boolean;
  errors?: Record<string, string>;
};

function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-4 ${star <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

export function RatingSummary({ rating }: { rating: CourseRating }) {
  if (rating.count === 0) {
    return <span className="text-sm text-muted-foreground">No reviews yet</span>;
  }

  return (
    <span className="flex items-center gap-1.5 text-sm">
      <Stars rating={rating.average} />
      <span className="font-medium">{rating.average.toFixed(1)}</span>
      <span className="text-muted-foreground">
        ({rating.count} {rating.count === 1 ? "review" : "reviews"})
      </span>
    </span>
  );
}

export function CourseReviews({
  slug,
  enrolled,
  reviews,
  rating,
  existingReview,
}: {
  slug: string;
  enrolled: boolean;
  reviews: CourseReview[];
  rating: CourseRating;
  existingReview?: CourseReview;
}) {
  const fetcher = useFetcher<ReviewActionData>();
  const [selectedRating, setSelectedRating] = useState(
    existingReview?.rating ?? 0
  );
  const [content, setContent] = useState(existingReview?.content ?? "");
  const isSubmitting = fetcher.state !== "idle";
  const errors = fetcher.data?.errors;

  useEffect(() => {
    if (existingReview) {
      setSelectedRating(existingReview.rating);
      setContent(existingReview.content);
    }
  }, [existingReview?.id]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success(existingReview ? "Review updated." : "Thanks for your review!");
    }
  }, [fetcher.state, fetcher.data, existingReview]);

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Reviews</h2>
        <RatingSummary rating={rating} />
      </div>

      {enrolled && (
        <Card className="mb-6">
          <CardHeader>
            <h3 className="font-semibold">
              {existingReview ? "Your Review" : "Leave a Review"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {existingReview
                ? "You can update or remove your review at any time."
                : "Share your experience with other students."}
            </p>
          </CardHeader>
          <CardContent>
            <fetcher.Form method="post" action={`/courses/${slug}`}>
              {existingReview && (
                <input type="hidden" name="reviewId" value={existingReview.id} />
              )}
              <input type="hidden" name="rating" value={selectedRating} />

              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium">Your rating</legend>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                      aria-pressed={selectedRating === star}
                      onClick={() => setSelectedRating(star)}
                      className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Star
                        className={`size-7 ${star <= selectedRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    </button>
                  ))}
                  {selectedRating > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {selectedRating} / 5
                    </span>
                  )}
                </div>
                {errors?.rating && (
                  <p className="mt-1 text-sm text-destructive">{errors.rating}</p>
                )}
              </fieldset>

              <label htmlFor="review-content" className="mb-2 block text-sm font-medium">
                Your review
              </label>
              <Textarea
                id="review-content"
                name="content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="What did you like? What could be improved?"
                minLength={MIN_REVIEW_LENGTH}
                maxLength={MAX_REVIEW_LENGTH}
                rows={4}
                className="mb-1"
              />
              <div className="mb-4 flex items-center justify-between">
                {errors?.content ? (
                  <p className="text-sm text-destructive">{errors.content}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">
                  {content.length}/{MAX_REVIEW_LENGTH}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  name="intent"
                  value={existingReview ? "update-review" : "submit-review"}
                  disabled={isSubmitting || selectedRating === 0}
                >
                  {isSubmitting
                    ? "Saving..."
                    : existingReview
                      ? "Update Review"
                      : "Submit Review"}
                </Button>
                {existingReview && (
                  <Button
                    type="submit"
                    variant="outline"
                    name="intent"
                    value="delete-review"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="mr-1.5 size-4" />
                    Delete
                  </Button>
                )}
              </div>
            </fetcher.Form>
          </CardContent>
        </Card>
      )}

      {reviews.length === 0 ? (
        <p className="text-muted-foreground">
          No reviews yet. {enrolled ? "Be the first to share your thoughts!" : "Enroll to leave the first review."}
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <UserAvatar
                      name={review.userName}
                      avatarUrl={review.userAvatarUrl}
                      className="size-7"
                    />
                    <span className="text-sm font-medium">
                      {review.userName}
                      {review.id === existingReview?.id && " (you)"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Stars rating={review.rating} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {review.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
