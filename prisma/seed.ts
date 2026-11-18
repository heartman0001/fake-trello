import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Valid keys for rocicorp/fractional-indexing.
const position = (index: number) => `a${index}`;

async function main() {
  console.log('🌱 Starting seed...');

  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@fake-trello.com' },
    update: { name: 'Demo User', password: hashedPassword },
    create: {
      email: 'demo@fake-trello.com',
      password: hashedPassword,
      name: 'Demo User',
    },
  });
  console.log('👤 Created user:', user.email);

  const existingWorkspace = await prisma.workspace.findFirst({
    where: { name: 'Product Launch Team', ownerId: user.id },
  });

  if (existingWorkspace) {
    await prisma.workspace.delete({ where: { id: existingWorkspace.id } });
    console.log('♻️  Removed previous demo workspace');
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Product Launch Team',
      description: 'Team workspace for Q1 product launch',
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: UserRole.OWNER },
      },
    },
  });
  console.log('🏢 Created workspace:', workspace.name);

  const board = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      title: 'Product Launch',
      description: 'Q1 Product Launch Board',
    },
  });
  console.log('📋 Created board:', board.title);

  const columnTitles = ['Backlog', 'In Progress', 'In Review', 'Done'];
  const columns = [];
  for (let index = 0; index < columnTitles.length; index++) {
    columns.push(
      await prisma.column.create({
        data: {
          boardId: board.id,
          title: columnTitles[index],
          position: position(index),
        },
      }),
    );
  }
  console.log('🗂️  Created columns:', columnTitles.join(', '));

  const labelData = [
    { name: 'Urgent', color: '#ff595e' },
    { name: 'High Priority', color: '#ffca3a' },
    { name: 'Bug', color: '#8ac926' },
    { name: 'Feature', color: '#1982c4' },
  ];

  const labels = [];
  for (const data of labelData) {
    labels.push(await prisma.label.create({ data: { ...data, boardId: board.id } }));
  }
  console.log('🏷️  Created labels:', labelData.map((l) => l.name).join(', '));

  const [urgent, high, bug, feature] = labels;

  const cardsData = [
    {
      columnIndex: 0,
      title: 'Research competitor features',
      description: 'Analyze top 3 competitors and list their key features',
      labelIds: [urgent.id, high.id],
    },
    {
      columnIndex: 0,
      title: 'Define MVP scope',
      description: 'Determine core features for minimum viable product',
      labelIds: [feature.id],
    },
    {
      columnIndex: 1,
      title: 'Setup CI/CD pipeline',
      description: 'Configure GitHub Actions for automated deployments',
      labelIds: [feature.id],
    },
    {
      columnIndex: 1,
      title: 'Implement authentication',
      description: 'JWT-based authentication with refresh tokens',
      labelIds: [feature.id],
    },
    {
      columnIndex: 2,
      title: 'Database schema design',
      description: 'Finalize Prisma schema with all relationships',
      labelIds: [high.id, bug.id],
    },
    {
      columnIndex: 2,
      title: 'API documentation',
      description: 'Write OpenAPI/Swagger documentation',
      labelIds: [feature.id],
    },
    {
      columnIndex: 3,
      title: 'Project kickoff',
      description: 'Team alignment meeting and goal setting',
      labelIds: [high.id],
    },
    {
      columnIndex: 3,
      title: 'Initial architecture review',
      description: 'Review system design with stakeholders',
      labelIds: [urgent.id],
    },
  ];

  const cardCountByColumn = new Map<number, number>();

  for (const data of cardsData) {
    const indexInColumn = cardCountByColumn.get(data.columnIndex) ?? 0;
    cardCountByColumn.set(data.columnIndex, indexInColumn + 1);

    await prisma.card.create({
      data: {
        columnId: columns[data.columnIndex].id,
        title: data.title,
        description: data.description,
        position: position(indexInColumn),
        assigneeId: user.id,
        labels: {
          create: data.labelIds.map((labelId) => ({ labelId })),
        },
      },
    });
  }
  console.log('✅ Seed completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Email: demo@fake-trello.com');
  console.log('   Password: password123');
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
