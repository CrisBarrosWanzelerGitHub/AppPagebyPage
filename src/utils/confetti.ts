import confetti from 'canvas-confetti';

const COLORS = ['#f5c400', '#ffd700', '#ffffff'];

/**
 * Fires a quick golden rain from the top of the page.
 * Multiple staggered bursts spread across the full width simulate rainfall.
 */
export function fireAchievementConfetti(): void {
  // Wave 1 — 5 bursts across the top, staggered by 50ms
  const wave1 = [0.1, 0.3, 0.5, 0.7, 0.9];
  wave1.forEach((x, i) => {
    setTimeout(() => {
      confetti({
        particleCount: 28,
        angle: 270,          // straight down
        spread: 38,
        origin: { x, y: 0 },
        colors: COLORS,
        startVelocity: 22,
        gravity: 1.4,
        ticks: 220,
        scalar: 1.05,
      });
    }, i * 55);
  });

  // Wave 2 — fills the gaps, slight delay for depth
  const wave2 = [0.2, 0.4, 0.6, 0.8];
  wave2.forEach((x, i) => {
    setTimeout(() => {
      confetti({
        particleCount: 22,
        angle: 270,
        spread: 32,
        origin: { x, y: 0 },
        colors: COLORS,
        startVelocity: 18,
        gravity: 1.2,
        ticks: 240,
        scalar: 0.95,
      });
    }, 280 + i * 55);
  });
}
