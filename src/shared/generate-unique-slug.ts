import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlug } from './generate-slug';

export async function generateUniqueCourseSlug(
  prisma: PrismaService,
  title: string,
  excludeCourseId?: number,
): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.course.findFirst({
      where: {
        slug,
        ...(excludeCourseId && { id: { not: excludeCourseId } }),
      },
    });

    if (!existing) {
      return slug;
    }

    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}
