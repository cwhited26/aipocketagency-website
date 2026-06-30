import {
  parseAnswers,
  personaForAnswers,
  tierFromAnswers,
} from "@/lib/launch-funnel/quiz";
import {
  OPERATOR_COUNT,
  STAR_RATING,
  TESTIMONIALS,
} from "@/lib/launch-funnel/copy";
import FunnelView from "../_components/FunnelView";
import Offer from "../_components/Offer";

// The offer page. The quiz answers arrive as ?answers=; the matched tier and Persona drive the
// personalized header and the auto-highlighted plan. All state stays in the URL.
export default function OfferPage({
  searchParams,
}: {
  searchParams: { answers?: string };
}) {
  const answers = parseAnswers(searchParams.answers);
  const matchedTier = tierFromAnswers(answers);
  const personaPhrase = personaForAnswers(answers);

  return (
    <>
      <FunnelView event="funnel_offer_viewed" props={{ tier: matchedTier }} />
      <Offer
        matchedTier={matchedTier}
        personaPhrase={personaPhrase}
        answers={searchParams.answers ?? ""}
        operatorCount={OPERATOR_COUNT}
        starRating={STAR_RATING}
        testimonials={TESTIMONIALS}
      />
    </>
  );
}
