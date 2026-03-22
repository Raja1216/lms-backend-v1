import { LetterGrade } from '../generated/prisma/enums';
 
export interface GradeBand {
  minPercent: number;
  maxPercent: number;
  letterGrade: LetterGrade;
}
 
/** Default grade scale – used when no custom GradeScale exists for the course */
const DEFAULT_BANDS: GradeBand[] = [
  { minPercent: 90, maxPercent: 100, letterGrade: LetterGrade.A_PLUS },
  { minPercent: 80, maxPercent: 89.99, letterGrade: LetterGrade.A },
  { minPercent: 70, maxPercent: 79.99, letterGrade: LetterGrade.B },
  { minPercent: 60, maxPercent: 69.99, letterGrade: LetterGrade.C },
  { minPercent: 0, maxPercent: 59.99, letterGrade: LetterGrade.F },
];
 
export function calcPercentage(obtained: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((obtained / total) * 10000) / 100; // 2 decimal places
}
 
export function calcLetterGrade(
  percentage: number,
  bands: GradeBand[] = DEFAULT_BANDS,
): LetterGrade {
  const band = bands.find(
    (b) => percentage >= b.minPercent && percentage <= b.maxPercent,
  );
  return band ? band.letterGrade : LetterGrade.F;
}
 
/**
 * Calculate weighted rubric total.
 * rubricItems: array of { weight (0-100), marks (obtained), maxMarks }
 * Returns marks out of project.maxMarks
 */
export function calcRubricTotal(
  rubricItems: { weight: number; marks: number; maxMarks: number }[],
  projectMaxMarks: number,
): number {
  const weightedScore = rubricItems.reduce((acc, item) => {
    const itemPercent = item.maxMarks > 0 ? item.marks / item.maxMarks : 0;
    return acc + itemPercent * (item.weight / 100);
  }, 0);
  return Math.round(weightedScore * projectMaxMarks * 100) / 100;
}
 