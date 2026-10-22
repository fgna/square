import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Guard: this seed creates well-known demo credentials.
// It must not run unintentionally in production.
// Set SEED_DEMO_DATA=true to enable it (local dev and CI only).
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA === 'true';
if (!SEED_DEMO_DATA) {
  console.log(
    'Demo seed skipped — SEED_DEMO_DATA is not set to "true".\n' +
    'To seed demo data for local development, run:\n' +
    '  SEED_DEMO_DATA=true pnpm db:seed\n' +
    'Do NOT run the demo seed in production.',
  );
  process.exit(0);
}

async function main() {
  console.log('Starting database seed (demo data)...');

  // Create admin user
  const adminPasswordHash = await argon2.hash('Admin123!@#');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      name: 'Platform Admin',
      bio: 'Platform administrator',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  // Create sample members
  const memberPasswordHash = await argon2.hash('Member123!@#');
  const members = await Promise.all([
    prisma.user.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: {
        email: 'alice@example.com',
        passwordHash: memberPasswordHash,
        name: 'Alice Johnson',
        bio: 'Full-stack developer passionate about React and Node.js',
        role: Role.MEMBER,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: {
        email: 'bob@example.com',
        passwordHash: memberPasswordHash,
        name: 'Bob Smith',
        bio: 'DevOps engineer and cloud architecture enthusiast',
        role: Role.MEMBER,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'carol@example.com' },
      update: {},
      create: {
        email: 'carol@example.com',
        passwordHash: memberPasswordHash,
        name: 'Carol Williams',
        bio: 'UX designer focused on accessible and beautiful interfaces',
        role: Role.MEMBER,
        isActive: true,
      },
    }),
  ]);

  // Create sample posts
  const post1 = await prisma.post.create({
    data: {
      content: 'Welcome to our community platform! We\'re excited to have everyone here. Feel free to introduce yourself and start connecting with fellow members.',
      authorId: admin.id,
      isPinned: true,
    },
  });

  const post2 = await prisma.post.create({
    data: {
      content: 'Just completed the Advanced TypeScript course — highly recommended! The module on generics and utility types was eye-opening.',
      authorId: members[0].id,
    },
  });

  const post3 = await prisma.post.create({
    data: {
      content: 'Anyone using Docker Compose for local development? I\'ve been experimenting with multi-service setups and would love to hear best practices from the community.',
      authorId: members[1].id,
    },
  });

  // Add comments
  await prisma.comment.createMany({
    data: [
      {
        content: 'Great to be here! Looking forward to learning from everyone.',
        postId: post1.id,
        authorId: members[0].id,
      },
      {
        content: 'Excited to join this community!',
        postId: post1.id,
        authorId: members[1].id,
      },
      {
        content: 'I\'ll have to check that course out. Thanks for the recommendation!',
        postId: post2.id,
        authorId: members[1].id,
      },
      {
        content: 'Yes! I use Docker Compose extensively. Happy to share my setup.',
        postId: post3.id,
        authorId: members[2].id,
      },
    ],
  });

  // Add reactions
  await prisma.reaction.createMany({
    data: [
      { type: 'LIKE', postId: post1.id, userId: members[0].id },
      { type: 'HEART', postId: post1.id, userId: members[1].id },
      { type: 'CELEBRATE', postId: post1.id, userId: members[2].id },
      { type: 'LIKE', postId: post2.id, userId: members[1].id },
      { type: 'INSIGHTFUL', postId: post2.id, userId: members[2].id },
      { type: 'LIKE', postId: post3.id, userId: members[0].id },
    ],
  });

  // Create sample courses
  const course1 = await prisma.course.create({
    data: {
      title: 'Advanced TypeScript Mastery',
      description: 'Deep dive into TypeScript generics, utility types, decorators, and advanced patterns for building enterprise applications.',
      isPublished: true,
      modules: {
        create: [
          {
            title: 'TypeScript Generics',
            order: 1,
            lessons: {
              create: [
                { title: 'Introduction to Generics', content: '# Introduction to Generics\n\nGenerics provide a way to make components work with any data type...', order: 1 },
                { title: 'Generic Constraints', content: '# Generic Constraints\n\nConstraints allow you to limit the types that can be used...', order: 2 },
                { title: 'Generic Utility Types', content: '# Utility Types\n\nTypeScript provides several utility types to facilitate common type transformations...', order: 3 },
              ],
            },
          },
          {
            title: 'Advanced Patterns',
            order: 2,
            lessons: {
              create: [
                { title: 'Decorators', content: '# Decorators\n\nDecorators provide a way to add both annotations and meta-programming syntax...', order: 1 },
                { title: 'Conditional Types', content: '# Conditional Types\n\nConditional types select one of two possible types based on a condition...', order: 2 },
              ],
            },
          },
        ],
      },
    },
  });

  const course2 = await prisma.course.create({
    data: {
      title: 'Docker & Kubernetes for Developers',
      description: 'Learn containerization from Docker basics to Kubernetes orchestration. Build production-ready deployment pipelines.',
      isPublished: true,
      modules: {
        create: [
          {
            title: 'Docker Fundamentals',
            order: 1,
            lessons: {
              create: [
                { title: 'What is Docker?', content: '# What is Docker?\n\nDocker is a platform for developing, shipping, and running applications in containers...', order: 1 },
                { title: 'Dockerfile Best Practices', content: '# Dockerfile Best Practices\n\nWriting efficient Dockerfiles is crucial for production deployments...', order: 2 },
              ],
            },
          },
          {
            title: 'Kubernetes Basics',
            order: 2,
            lessons: {
              create: [
                { title: 'Kubernetes Architecture', content: '# Kubernetes Architecture\n\nKubernetes organizes containerized workloads into Pods, Services, and Deployments...', order: 1 },
                { title: 'Deployments and Services', content: '# Deployments and Services\n\nDeployments manage the lifecycle of Pods...', order: 2 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.course.create({
    data: {
      title: 'React Performance Optimization',
      description: 'Master React performance techniques including memoization, code splitting, lazy loading, and profiling.',
      isPublished: false,
      modules: {
        create: [
          {
            title: 'React Rendering',
            order: 1,
            lessons: {
              create: [
                { title: 'Understanding React Re-renders', content: '# Understanding React Re-renders\n\nReact re-renders when state or props change...', order: 1 },
              ],
            },
          },
        ],
      },
    },
  });

  // Create progress for members
  await prisma.progress.createMany({
    data: [
      { userId: members[0].id, courseId: course1.id, percentage: 60 },
      { userId: members[1].id, courseId: course2.id, percentage: 30 },
      { userId: members[2].id, courseId: course1.id, percentage: 100, completedAt: new Date() },
    ],
  });

  // Create sample events
  const now = new Date();
  const event1 = await prisma.event.create({
    data: {
      title: 'Monthly Community Meetup',
      description: 'Join us for our monthly virtual meetup where we discuss the latest in tech, share projects, and connect with fellow community members.',
      startsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      isVirtual: true,
      meetingUrl: 'https://meet.example.com/community-meetup',
      maxRsvps: 100,
    },
  });

  const event2 = await prisma.event.create({
    data: {
      title: 'TypeScript Workshop',
      description: 'Hands-on workshop covering advanced TypeScript patterns. Bring your laptop and be ready to code!',
      startsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      isVirtual: false,
      location: 'Tech Hub, 123 Main St, San Francisco, CA',
      maxRsvps: 30,
    },
  });

  await prisma.event.create({
    data: {
      title: 'Year-End Celebration & Retrospective',
      description: 'Let\'s celebrate our community\'s achievements this year and plan for the future!',
      startsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      isVirtual: true,
      meetingUrl: 'https://meet.example.com/year-end',
    },
  });

  // Create RSVPs
  await prisma.eventRsvp.createMany({
    data: [
      { eventId: event1.id, userId: admin.id, status: 'GOING' },
      { eventId: event1.id, userId: members[0].id, status: 'GOING' },
      { eventId: event1.id, userId: members[1].id, status: 'MAYBE' },
      { eventId: event2.id, userId: members[0].id, status: 'GOING' },
      { eventId: event2.id, userId: members[2].id, status: 'GOING' },
    ],
  });

  console.log('Database seeded successfully!');
  console.log(`Admin: admin@example.com / Admin123!@#`);
  console.log(`Member: alice@example.com / Member123!@#`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
