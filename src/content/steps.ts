// The three-step onboarding flow, shared so the homepage "how it works" section
// and the first-visit banner on the tool page can never drift apart. Kept as
// plain data (no JSX) so either surface can render it however it likes.

export interface OnboardingStep {
  title: string;
  body: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Choose a color',
    body: 'Pick any color you like from the sidebar.',
  },
  {
    title: 'Find your separator',
    body: 'Browse the categories, or search shapes, arrows, numbers, and more.',
  },
  {
    title: 'Drag to your bookmarks bar',
    body: "Drag the separator straight onto your browser's bookmarks bar. That's it.",
  },
];
