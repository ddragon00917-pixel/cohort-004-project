import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Pencil, Star, Trash2 } from "lucide-react";
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

type ReviewIntent = "submit-review" | "update-review" | "delete-review";

type ReviewActionData = {
  success?: boolean;
  intent?: ReviewIntent;
  errors?: Record<string, string>;
};

const SUCCESS_MESSAGES: Record<ReviewIntent, string> = {
  "submit-review": "Thanks for your review!",
  "update-review": "Review updated.",
  "delete-review": "Review deleted.",
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
  const [selectedRating, setSelectedRating] = useState(0);
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const handledResult = useRef<ReviewActionData | null>(null);
  const isSubmitting = fetcher.state !== "idle";
  const errors = fetcher.data?.errors;

  // A review's text lives in its list card, not in a lingering form. Only one
  // toast per completed action, chosen from the intent the action actually ran.
  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data?.success &&
      handledResult.current !== fetcher.data
    ) {
      handledResult.current = fetcher.data;
      toast.success(
        fetcher.data.intent
          ? SUCCESS_MESSAGES[fetcher.data.intent]
          : "Review saved."
      );
      setSelectedRating(0);
      setContent("");
      setIsEditing(false);
    }
  }, [fetcher.state, fetcher.data]);

  function startEditing(review: CourseReview) {
    setSelectedRating(review.rating);
    setContent(review.content);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setSelectedRating(0);
    setContent("");
  }

  function renderForm(reviewId?: number) {
    const isEdit = reviewId !== undefined;

    return (
      <fetcher.Form method="post" action={`/courses/${slug}`}>
        {isEdit && <input type="hidden" name="reviewId" value={reviewId} />}
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
            value={isEdit ? "update-review" : "submit-review"}
            disabled={isSubmitting || selectedRating === 0}
          >
            {isSubmitting
              ? "Saving..."
              : isEdit
                ? "Save Changes"
                : "Submit Review"}
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="ghost"
              onClick={cancelEditing}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
        </div>
      </fetcher.Form>
    );
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Reviews</h2>
        <RatingSummary rating={rating} />
      </div>

      {enrolled && !existingReview && (
        <Card className="mb-6">
          <CardHeader>
            <h3 className="font-semibold">Leave a Review</h3>
            <p className="text-sm text-muted-foreground">
              Share your experience with other students.
            </p>
          </CardHeader>
          <CardContent>{renderForm()}</CardContent>
        </Card>
      )}

      {reviews.length === 0 ? (
        <p className="text-muted-foreground">
          No reviews yet. {enrolled ? "Be the first to share your thoughts!" : "Enroll to leave the first review."}
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const isOwn = review.id === existingReview?.id;
            const editingThis = isOwn && isEditing;

            return (
              <Card key={review.id}>
                <CardContent className="p-5">
                  {editingThis ? (
                    <>
                      <h3 className="mb-4 font-semibold">Edit your review</h3>
                      {renderForm(review.id)}
                    </>
                  ) : (
                    <>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <UserAvatar
                            name={review.userName}
                            avatarUrl={review.userAvatarUrl}
                            className="size-7"
                          />
                          <span className="text-sm font-medium">
                            {review.userName}
                            {isOwn && " (you)"}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          {isOwn && (
                            <span className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(review)}
                                disabled={isSubmitting}
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </Button>
                              <fetcher.Form
                                method="post"
                                action={`/courses/${slug}`}
                                onSubmit={(event) => {
                                  if (
                                    !window.confirm(
                                      "Delete your review? This cannot be undone."
                                    )
                                  ) {
                                    event.preventDefault();
                                  }
                                }}
                              >
                                <input
                                  type="hidden"
                                  name="reviewId"
                                  value={review.id}
                                />
                                <Button
                                  type="submit"
                                  name="intent"
                                  value="delete-review"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isSubmitting}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                  Delete
                                </Button>
                              </fetcher.Form>
                            </span>
                          )}
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
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
