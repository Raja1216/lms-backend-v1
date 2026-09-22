import { PrismaClient, XpType, XpRepeatPolicy, BadgeCategory, BadgeRarity } from '../../generated/prisma/client';
import { GamificationEventKey } from '../events/gamification-event.keys';

export async function seedGamification(prisma: PrismaClient) {
  console.log('Seeding Gamification Levels...');
  const levels = [
    { levelNumber: 1, title: 'Beginner', minimumTotalXp: 0, minimumPerformanceXp: 0 },
    { levelNumber: 2, title: 'Explorer', minimumTotalXp: 250, minimumPerformanceXp: 50 },
    { levelNumber: 3, title: 'Learner', minimumTotalXp: 600, minimumPerformanceXp: 150 },
    { levelNumber: 4, title: 'Achiever', minimumTotalXp: 1200, minimumPerformanceXp: 350 },
    { levelNumber: 5, title: 'Skilled', minimumTotalXp: 2000, minimumPerformanceXp: 600 },
    { levelNumber: 6, title: 'Specialist', minimumTotalXp: 3500, minimumPerformanceXp: 1100 },
    { levelNumber: 7, title: 'Expert', minimumTotalXp: 5500, minimumPerformanceXp: 1800 },
    { levelNumber: 8, title: 'Master', minimumTotalXp: 8000, minimumPerformanceXp: 2800 },
    { levelNumber: 9, title: 'Champion', minimumTotalXp: 12000, minimumPerformanceXp: 4500 },
    { levelNumber: 10, title: 'Legend', minimumTotalXp: 20000, minimumPerformanceXp: 8000 },
  ];

  for (const lvl of levels) {
    await prisma.gamificationLevel.upsert({
      where: { levelNumber: lvl.levelNumber },
      update: {
        title: lvl.title,
        minimumTotalXp: lvl.minimumTotalXp,
        minimumPerformanceXp: lvl.minimumPerformanceXp,
      },
      create: {
        levelNumber: lvl.levelNumber,
        title: lvl.title,
        minimumTotalXp: lvl.minimumTotalXp,
        minimumPerformanceXp: lvl.minimumPerformanceXp,
      },
    });
  }

  console.log('Seeding Gamification XP Rules...');
  const rules = [
    // Onboarding
    { ruleName: 'Complete Registration', eventKey: GamificationEventKey.REGISTRATION_COMPLETED, xpType: XpType.ENGAGEMENT, xpAmount: 20, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'Verify Email', eventKey: GamificationEventKey.EMAIL_VERIFIED, xpType: XpType.ENGAGEMENT, xpAmount: 10, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'Verify Mobile Number', eventKey: GamificationEventKey.MOBILE_VERIFIED, xpType: XpType.ENGAGEMENT, xpAmount: 10, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'Complete Profile', eventKey: GamificationEventKey.PROFILE_COMPLETED, xpType: XpType.ENGAGEMENT, xpAmount: 20, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'Add Profile Photo', eventKey: GamificationEventKey.PROFILE_PHOTO_ADDED, xpType: XpType.ENGAGEMENT, xpAmount: 5, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'Select Interests/Skills', eventKey: GamificationEventKey.SKILLS_SELECTED, xpType: XpType.ENGAGEMENT, xpAmount: 10, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'Join Institution', eventKey: GamificationEventKey.INSTITUTION_JOINED, xpType: XpType.ENGAGEMENT, xpAmount: 10, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'First Course Enrollment', eventKey: GamificationEventKey.FIRST_COURSE_ENROLLED, xpType: XpType.ENGAGEMENT, xpAmount: 20, repeatPolicy: XpRepeatPolicy.ONCE_EVER },

    // Course Learning
    { ruleName: 'Start Course', eventKey: GamificationEventKey.COURSE_STARTED, xpType: XpType.ENGAGEMENT, xpAmount: 10, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Video Lesson', eventKey: GamificationEventKey.LESSON_VIDEO_COMPLETED, xpType: XpType.ENGAGEMENT, xpAmount: 10, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Document Lesson', eventKey: GamificationEventKey.LESSON_DOCUMENT_COMPLETED, xpType: XpType.ENGAGEMENT, xpAmount: 8, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Article Lesson', eventKey: GamificationEventKey.LESSON_ARTICLE_COMPLETED, xpType: XpType.ENGAGEMENT, xpAmount: 5, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Audio Lesson', eventKey: GamificationEventKey.LESSON_AUDIO_COMPLETED, xpType: XpType.ENGAGEMENT, xpAmount: 8, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Interactive Lesson', eventKey: GamificationEventKey.LESSON_INTERACTIVE_COMPLETED, xpType: XpType.ENGAGEMENT, xpAmount: 15, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Chapter', eventKey: GamificationEventKey.CHAPTER_COMPLETED, xpType: XpType.PERFORMANCE, xpAmount: 25, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Module', eventKey: GamificationEventKey.MODULE_COMPLETED, xpType: XpType.PERFORMANCE, xpAmount: 50, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Subject', eventKey: GamificationEventKey.SUBJECT_COMPLETED, xpType: XpType.PERFORMANCE, xpAmount: 100, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: '25% Course Completion', eventKey: GamificationEventKey.COURSE_PROGRESS_25, xpType: XpType.PERFORMANCE, xpAmount: 25, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: '50% Course Completion', eventKey: GamificationEventKey.COURSE_PROGRESS_50, xpType: XpType.PERFORMANCE, xpAmount: 50, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: '75% Course Completion', eventKey: GamificationEventKey.COURSE_PROGRESS_75, xpType: XpType.PERFORMANCE, xpAmount: 75, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Course', eventKey: GamificationEventKey.COURSE_COMPLETED, xpType: XpType.PERFORMANCE, xpAmount: 200, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Mandatory Activities', eventKey: GamificationEventKey.MANDATORY_ACTIVITIES_COMPLETED, xpType: XpType.PERFORMANCE, xpAmount: 100, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },

    // Quiz & Examinations
    { ruleName: 'Attempt Quiz', eventKey: GamificationEventKey.QUIZ_ATTEMPTED, xpType: XpType.ENGAGEMENT, xpAmount: 5, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Mock Test', eventKey: GamificationEventKey.MOCK_TEST_COMPLETED, xpType: XpType.ENGAGEMENT, xpAmount: 10, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Pass Lesson Quiz', eventKey: GamificationEventKey.QUIZ_PASSED_LESSON, xpType: XpType.PERFORMANCE, xpAmount: 15, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Pass Chapter Quiz', eventKey: GamificationEventKey.QUIZ_PASSED_CHAPTER, xpType: XpType.PERFORMANCE, xpAmount: 25, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Pass Module Quiz', eventKey: GamificationEventKey.QUIZ_PASSED_MODULE, xpType: XpType.PERFORMANCE, xpAmount: 40, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Pass Subject Exam', eventKey: GamificationEventKey.EXAM_PASSED_SUBJECT, xpType: XpType.PERFORMANCE, xpAmount: 75, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Pass Course Exam', eventKey: GamificationEventKey.EXAM_PASSED_COURSE, xpType: XpType.PERFORMANCE, xpAmount: 150, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Pass on First Attempt', eventKey: GamificationEventKey.QUIZ_FIRST_ATTEMPT_PASS, xpType: XpType.PERFORMANCE, xpAmount: 25, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },

    // Projects
    { ruleName: 'Submit Assignment', eventKey: GamificationEventKey.ASSIGNMENT_SUBMITTED, xpType: XpType.ENGAGEMENT, xpAmount: 15, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Submit Project', eventKey: GamificationEventKey.PROJECT_SUBMITTED, xpType: XpType.ENGAGEMENT, xpAmount: 20, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Submit Project Before Deadline', eventKey: GamificationEventKey.PROJECT_SUBMITTED_EARLY, xpType: XpType.ENGAGEMENT, xpAmount: 10, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Pass Project', eventKey: GamificationEventKey.PROJECT_PASSED, xpType: XpType.PERFORMANCE, xpAmount: 75, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Excellent Rubric Rating', eventKey: GamificationEventKey.PROJECT_RUBRIC_EXCELLENT, xpType: XpType.PERFORMANCE, xpAmount: 25, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Successful Resubmission', eventKey: GamificationEventKey.PROJECT_RESUBMISSION_PASS, xpType: XpType.PERFORMANCE, xpAmount: 20, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Complete Capstone', eventKey: GamificationEventKey.CAPSTONE_COMPLETED, xpType: XpType.PERFORMANCE, xpAmount: 150, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Featured Project', eventKey: GamificationEventKey.PROJECT_FEATURED, xpType: XpType.PERFORMANCE, xpAmount: 100, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },

    // Certificates
    { ruleName: 'Earn First Certificate', eventKey: GamificationEventKey.CERTIFICATE_FIRST, xpType: XpType.PERFORMANCE, xpAmount: 50, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'Course Certificate', eventKey: GamificationEventKey.CERTIFICATE_COURSE, xpType: XpType.PERFORMANCE, xpAmount: 100, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Project Certificate', eventKey: GamificationEventKey.CERTIFICATE_PROJECT, xpType: XpType.PERFORMANCE, xpAmount: 75, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Achievement Certificate', eventKey: GamificationEventKey.CERTIFICATE_ACHIEVEMENT, xpType: XpType.PERFORMANCE, xpAmount: 50, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
    { ruleName: 'Earn 5 Certificates', eventKey: GamificationEventKey.CERTIFICATE_5_EARNED, xpType: XpType.PERFORMANCE, xpAmount: 100, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'Earn 10 Certificates', eventKey: GamificationEventKey.CERTIFICATE_10_EARNED, xpType: XpType.PERFORMANCE, xpAmount: 250, repeatPolicy: XpRepeatPolicy.ONCE_EVER },
    { ruleName: 'Complete Certification Course', eventKey: GamificationEventKey.CERTIFICATION_COURSE_COMPLETED, xpType: XpType.PERFORMANCE, xpAmount: 300, repeatPolicy: XpRepeatPolicy.ONCE_PER_CONTENT },
  ];

  for (const r of rules) {
    await prisma.gamificationXpRule.upsert({
      where: { eventKey: r.eventKey },
      update: {
        ruleName: r.ruleName,
        xpType: r.xpType,
        xpAmount: r.xpAmount,
        repeatPolicy: r.repeatPolicy,
      },
      create: {
        ruleName: r.ruleName,
        eventKey: r.eventKey,
        xpType: r.xpType,
        xpAmount: r.xpAmount,
        repeatPolicy: r.repeatPolicy,
      },
    });
  }

  console.log('Seeding Badges...');
  const badges = [
    { name: 'First Step', slug: 'first-step', description: 'Complete your first lesson', icon: '🎯', category: BadgeCategory.LEARNING, rarity: BadgeRarity.COMMON, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Course Starter', slug: 'course-starter', description: 'Start your first course', icon: '🚀', category: BadgeCategory.LEARNING, rarity: BadgeRarity.COMMON, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Quick Learner', slug: 'quick-learner', description: 'Complete 5 lessons', icon: '⚡', category: BadgeCategory.LEARNING, rarity: BadgeRarity.COMMON, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Active Learner', slug: 'active-learner', description: 'Complete 25 lessons', icon: '📖', category: BadgeCategory.LEARNING, rarity: BadgeRarity.UNCOMMON, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Dedicated Learner', slug: 'dedicated-learner', description: 'Complete 50 lessons', icon: '📚', category: BadgeCategory.LEARNING, rarity: BadgeRarity.RARE, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Learning Machine', slug: 'learning-machine', description: 'Complete 100 lessons', icon: '🤖', category: BadgeCategory.LEARNING, rarity: BadgeRarity.EPIC, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Course Finisher', slug: 'course-finisher', description: 'Complete your first course', icon: '🎓', category: BadgeCategory.LEARNING, rarity: BadgeRarity.UNCOMMON, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Course Explorer', slug: 'course-explorer', description: 'Complete 5 courses', icon: '🗺️', category: BadgeCategory.LEARNING, rarity: BadgeRarity.RARE, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Master Learner', slug: 'master-learner', description: 'Complete 10 courses', icon: '👑', category: BadgeCategory.LEARNING, rarity: BadgeRarity.EPIC, conditionType: 'COUNT_THRESHOLD' },

    { name: 'Perfect Score', slug: 'perfect-score', description: 'Score 100% on a quiz', icon: '💯', category: BadgeCategory.QUIZ, rarity: BadgeRarity.UNCOMMON, conditionType: 'SPECIFIC_EVENT' },
    { name: 'Quiz Champion', slug: 'quiz-champion', description: 'Pass 25 quizzes', icon: '🏆', category: BadgeCategory.QUIZ, rarity: BadgeRarity.RARE, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Quiz Master', slug: 'quiz-master', description: 'Pass 50 quizzes', icon: '🥇', category: BadgeCategory.QUIZ, rarity: BadgeRarity.EPIC, conditionType: 'COUNT_THRESHOLD' },

    { name: 'Getting Started', slug: 'getting-started', description: 'Achieve a 3-day learning streak', icon: '🔥', category: BadgeCategory.STREAK, rarity: BadgeRarity.COMMON, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Weekly Warrior', slug: 'weekly-warrior', description: 'Achieve a 7-day learning streak', icon: '⚔️', category: BadgeCategory.STREAK, rarity: BadgeRarity.UNCOMMON, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Consistency Builder', slug: 'consistency-builder', description: 'Achieve a 14-day learning streak', icon: '🛡️', category: BadgeCategory.STREAK, rarity: BadgeRarity.RARE, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Consistent Learner', slug: 'consistent-learner', description: 'Achieve a 30-day learning streak', icon: '💎', category: BadgeCategory.STREAK, rarity: BadgeRarity.RARE, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Determined Learner', slug: 'determined-learner', description: 'Achieve a 60-day learning streak', icon: '🌟', category: BadgeCategory.STREAK, rarity: BadgeRarity.EPIC, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Unstoppable', slug: 'unstoppable', description: 'Achieve a 100-day learning streak', icon: '⚡', category: BadgeCategory.STREAK, rarity: BadgeRarity.EPIC, conditionType: 'COUNT_THRESHOLD' },
    { name: 'Year Warrior', slug: 'year-warrior', description: 'Achieve a 365-day learning streak', icon: '🏆', category: BadgeCategory.STREAK, rarity: BadgeRarity.LEGENDARY, conditionType: 'COUNT_THRESHOLD' },

    { name: 'Certified Learner', slug: 'certified-learner', description: 'Earn your first certificate', icon: '📜', category: BadgeCategory.CERTIFICATE, rarity: BadgeRarity.UNCOMMON, conditionType: 'COUNT_THRESHOLD' },
    { name: 'AI Pioneer', slug: 'ai-pioneer', description: 'Complete 3 AI courses and 2 AI projects', icon: '🤖', category: BadgeCategory.DOMAIN, rarity: BadgeRarity.RARE, conditionType: 'MULTI_CRITERIA_JSON' },
    { name: 'EduVerse Legend', slug: 'eduverse-legend', description: 'Reach Level 10 Legend', icon: '👑', category: BadgeCategory.DOMAIN, rarity: BadgeRarity.LEGENDARY, conditionType: 'LEVEL_REACHED' },
  ];

  for (const b of badges) {
    await prisma.badge.upsert({
      where: { slug: b.slug },
      update: {
        name: b.name,
        description: b.description,
        icon: b.icon,
        category: b.category,
        rarity: b.rarity,
        conditionType: b.conditionType,
      },
      create: {
        name: b.name,
        slug: b.slug,
        description: b.description,
        icon: b.icon,
        category: b.category,
        rarity: b.rarity,
        conditionType: b.conditionType,
      },
    });
  }

  console.log('Gamification seeding completed successfully!');
}
