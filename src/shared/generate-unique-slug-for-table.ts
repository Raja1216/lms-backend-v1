import slugify from "slugify";
import { PrismaClient } from "src/generated/prisma/client";


export async function generateUniqueSlugForTable(
  prisma: PrismaClient | any,
  table:
    | 'course'
    | 'subject'
    | 'module'
    | 'chapter'
    | 'lesson',
  title: string,
) {
  const baseSlug = slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const exists = await prisma[table].findFirst({
      where: { slug },
      select: { id: true },
    });

    if (!exists) break;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
