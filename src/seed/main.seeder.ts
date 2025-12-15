import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaService();
import { generateSlug } from '../shared/generate-slug';
async function main() {
  console.log('Starting database seeding...');

  await prisma.$connect();

  console.log('Seeding permissions...');

  const permissionData = [
    { name: 'Create Users', description: 'Ability to create new users' },
    { name: 'Read Users', description: 'Ability to view users' },
    { name: 'Update Users', description: 'Ability to update user details' },
    { name: 'Delete Users', description: 'Ability to delete users' },

    { name: 'Create Roles', description: 'Ability to create new roles' },
    { name: 'Read Roles', description: 'Ability to view roles' },
    { name: 'Update Roles', description: 'Ability to update role details' },
    { name: 'Delete Roles', description: 'Ability to delete roles' },

    {
      name: 'Create Permissions',
      description: 'Ability to create new permissions',
    },
    { name: 'Read Permissions', description: 'Ability to view permissions' },
    {
      name: 'Update Permissions',
      description: 'Ability to update permission details',
    },
    {
      name: 'Delete Permissions',
      description: 'Ability to delete permissions',
    },
  ];

  const permissions: any[] = [];

  for (const data of permissionData) {
    const permission = await prisma.permission.upsert({
      where: { name: data.name },
      update: {},
      create: {
        name: data.name,
        description: data.description,
        slug: generateSlug(data.name),
      },
    });
    permissions.push(permission);
  }

  console.log('Seeding roles...');

  const superAdminRole = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: {
      permissions: {
        set: permissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      name: 'Super Admin',
      description: 'Role with all permissions',
      slug: generateSlug('Super Admin'),
      permissions: {
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
  });

  const readPermissions = permissions.filter((p) => p.name.startsWith('Read'));

  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {
      permissions: {
        set: readPermissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      name: 'Admin',
      description: 'Regular user with limited permissions',
      slug: generateSlug('Admin'),
      permissions: {
        connect: readPermissions.map((p) => ({ id: p.id })),
      },
    },
  });

  console.log('Seeding users...');

  await prisma.user.upsert({
    where: { email: 'super_admin@app.com' },
    update: {
      roles: {
        set: [{ id: superAdminRole.id }],
      },
    },
    create: {
      email: 'super_admin@app.com',
      password: bcrypt.hashSync('superpassword', 10),
      username: 'superadmin',
      roles: {
        connect: [{ id: superAdminRole.id }],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@app.com' },
    update: {
      roles: {
        set: [{ id: adminRole.id }],
      },
    },
    create: {
      email: 'admin@app.com',
      password: bcrypt.hashSync('password', 10),
      roles: {
        connect: [{ id: adminRole.id }],
      },
    },
  });

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
