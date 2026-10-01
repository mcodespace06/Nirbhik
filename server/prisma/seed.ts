import { PrismaClient, Role, UserStatus, RestrictedQueue, Priority } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting CampusVoice database seed...');

  // 1. Categories
  const categoriesData = [
    { name: 'Academic', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Infrastructure', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Hostel', severityWeight: 15, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Canteen', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Transport', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Harassment', severityWeight: 40, routesToQueue: RestrictedQueue.ICC, isSafety: true },
    { name: 'Ragging', severityWeight: 45, routesToQueue: RestrictedQueue.ANTI_RAGGING, isSafety: true },
    { name: 'Discrimination', severityWeight: 35, routesToQueue: RestrictedQueue.NONE, isSafety: true },
    { name: 'Cyber-bullying', severityWeight: 25, routesToQueue: RestrictedQueue.NONE, isSafety: true },
    { name: 'Corruption/Misconduct', severityWeight: 30, routesToQueue: RestrictedQueue.NONE, isSafety: false },
    { name: 'Safety/Security', severityWeight: 40, routesToQueue: RestrictedQueue.NONE, isSafety: true },
    { name: 'Mental-wellbeing', severityWeight: 25, routesToQueue: RestrictedQueue.NONE, isSafety: true },
    { name: 'Other', severityWeight: 10, routesToQueue: RestrictedQueue.NONE, isSafety: false },
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: cat,
      create: cat,
    });
  }
  console.log(`[Seed] Seeded ${categoriesData.length} categories.`);

  // 2. Campus Locations
  const locationsData = [
    { name: 'Main Administrative Block', lat: 19.0760, lng: 72.8777 },
    { name: 'Central University Library', lat: 19.0765, lng: 72.8782 },
    { name: 'Science & Engineering Complex', lat: 19.0772, lng: 72.8790 },
    { name: 'North Campus Boys Hostel', lat: 19.0780, lng: 72.8765 },
    { name: 'South Campus Girls Hostel', lat: 19.0750, lng: 72.8755 },
    { name: 'University Cafeteria & Food Court', lat: 19.0762, lng: 72.8770 },
    { name: 'Indoor Sports & Gym Pavilion', lat: 19.0785, lng: 72.8780 },
    { name: 'Main Entrance & Gate 1', lat: 19.0745, lng: 72.8775 },
  ];

  for (const loc of locationsData) {
    await prisma.location.upsert({
      where: { name: loc.name },
      update: loc,
      create: loc,
    });
  }
  console.log(`[Seed] Seeded ${locationsData.length} locations.`);

  // 3. Police Stations (for SOS Haversine dispatch)
  const policeStationsData = [
    {
      name: 'Campus Central Police Station',
      email: 'ps.central@police.gov.in',
      phone: '+912226500100',
      lat: 19.0770,
      lng: 72.8785,
      active: true,
    },
    {
      name: 'North District Police Precinct',
      email: 'ps.north@police.gov.in',
      phone: '+912226500200',
      lat: 19.0820,
      lng: 72.8760,
      active: true,
    },
    {
      name: 'University Metro Police Post',
      email: 'ps.metro@police.gov.in',
      phone: '+912226500300',
      lat: 19.0730,
      lng: 72.8810,
      active: true,
    },
  ];

  for (const ps of policeStationsData) {
    const existing = await prisma.policeStation.findFirst({ where: { name: ps.name } });
    if (!existing) {
      await prisma.policeStation.create({ data: ps });
    }
  }
  console.log(`[Seed] Seeded ${policeStationsData.length} police stations.`);

  // 4. SLA Policies
  const slaData = [
    { priority: Priority.CRITICAL, firstResponseHours: 2, resolutionHours: 24 },
    { priority: Priority.HIGH, firstResponseHours: 24, resolutionHours: 72 },
    { priority: Priority.MEDIUM, firstResponseHours: 72, resolutionHours: 240 },
    { priority: Priority.LOW, firstResponseHours: 168, resolutionHours: 720 },
  ];

  for (const sla of slaData) {
    await prisma.slaPolicy.upsert({
      where: { priority: sla.priority },
      update: sla,
      create: sla,
    });
  }
  console.log(`[Seed] Seeded ${slaData.length} SLA policies.`);

  // 5. College Roster (Demo Students and Faculty)
  const rosterData = [
    { enrollmentNo: 'EN2026001', fullName: 'Aarav Sharma', collegeEmail: 'aarav.sharma@college.edu', role: Role.STUDENT, department: 'Computer Science' },
    { enrollmentNo: 'EN2026002', fullName: 'Diya Patel', collegeEmail: 'diya.patel@college.edu', role: Role.STUDENT, department: 'Mechanical Engineering' },
    { enrollmentNo: 'EN2026003', fullName: 'Rohan Verma', collegeEmail: 'rohan.verma@college.edu', role: Role.STUDENT, department: 'Civil Engineering' },
    { enrollmentNo: 'FAC202601', fullName: 'Dr. Sunita Kulkarni', collegeEmail: 'sunita.kulkarni@college.edu', role: Role.TEACHER, department: 'Physics' },
    { enrollmentNo: 'FAC202602', fullName: 'Prof. Rajesh Nair', collegeEmail: 'rajesh.nair@college.edu', role: Role.TEACHER, department: 'Electrical Engineering' },
  ];

  for (const r of rosterData) {
    await prisma.collegeRoster.upsert({
      where: { enrollmentNo: r.enrollmentNo },
      update: r,
      create: r,
    });
  }
  console.log(`[Seed] Seeded ${rosterData.length} roster identities.`);

  // 6. Default Admin & Staff Accounts
  const defaultPasswordHash = await argon2.hash('Password@1234');

  const staffUsers = [
    {
      username: 'superadmin',
      collegeEmail: 'superadmin@campus.edu',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      department: 'Central Administration',
    },
    {
      username: 'admin_case1',
      collegeEmail: 'admin1@campus.edu',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      department: 'Student Affairs',
    },
    {
      username: 'admin_case2',
      collegeEmail: 'admin2@campus.edu',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      department: 'Disciplinary Committee',
    },
    {
      username: 'security_officer',
      collegeEmail: 'security@campus.edu',
      role: Role.SECURITY,
      status: UserStatus.ACTIVE,
      department: 'Campus Security',
      phone: '+919876543210',
    },
  ];

  for (const u of staffUsers) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        role: u.role,
        status: u.status,
      },
      create: {
        username: u.username,
        passwordHash: defaultPasswordHash,
        collegeEmail: u.collegeEmail,
        role: u.role,
        status: u.status,
        department: u.department,
        phone: u.phone,
      },
    });
  }
  console.log(`[Seed] Seeded ${staffUsers.length} administrative & security users.`);

  // 7. Sample Campus Rules
  const sampleRule = {
    title: 'University Anti-Ragging Code of Conduct',
    category: 'Disciplinary & Safety',
    bodyMd: `# Anti-Ragging Regulations

## 1. Zero Tolerance Mandate
The University maintains an absolute zero-tolerance policy against any form of ragging, bullying, or harassment within the campus premises, hostels, transport vehicles, or during sponsored events.

## 2. Prohibited Behaviors
- Physical contact, intimidation, or coercion of any junior student.
- Forcing attendance at unofficial gatherings or hostel rooms.
- Psychological abuse, offensive language, or degrading rituals.

## 3. Disciplinary Repercussions
Any student found guilty of engaging in or abetting ragging will face immediate suspension, hostel expulsion, and reporting to legal law enforcement under statutory state regulations.
`,
    version: 1,
    updatedBy: 'superadmin',
  };

  const existingRule = await prisma.ruleDocument.findFirst({ where: { title: sampleRule.title } });
  if (!existingRule) {
    await prisma.ruleDocument.create({ data: sampleRule });
  }
  // 8. Sample Complaints (for Analytics, Heatmap & Transparency Dashboards)
  const categories = await prisma.category.findMany();
  const locations = await prisma.location.findMany();
  const getCat = (name: string) => categories.find((c) => c.name === name)?.id || categories[0].id;
  const getLoc = (name: string) => locations.find((l) => l.name === name)?.id || locations[0].id;

  const sampleComplaints = [
    {
      hash: 'hash-demo-1',
      title: 'Broken ventilation and hazardous chemical odor in Lab 402',
      description: 'The exhaust system in Organic Chemistry Lab 402 has stopped functioning, leading to chemical fumes accumulating in student workstations.',
      catName: 'Infrastructure',
      locName: 'Science & Engineering Complex',
      priority: Priority.HIGH,
      status: ComplaintStatus.RESOLVED,
      pseudonym: 'Complainant #A7F3',
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      resolvedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      satisfactionRating: 5,
    },
    {
      hash: 'hash-demo-2',
      title: 'Curfew violations and rowdy behavior in corridor',
      description: 'Senior hostel block 3 residents played loud speakers and intimidated junior rooms until 3:30 AM repeatedly.',
      catName: 'Hostel',
      locName: 'North Campus Boys Hostel',
      priority: Priority.HIGH,
      status: ComplaintStatus.ESCALATED,
      pseudonym: 'Complainant #B92D',
      createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      resolvedAt: null,
      satisfactionRating: null,
    },
    {
      hash: 'hash-demo-3',
      title: 'Unlit dark pathway between Library back exit and sports field',
      description: 'Three high-mast light fixtures have been completely non-functional for over 2 weeks, creating severe safety risks at night.',
      catName: 'Safety/Security',
      locName: 'Central University Library',
      priority: Priority.HIGH,
      status: ComplaintStatus.IN_PROGRESS,
      pseudonym: 'Complainant #C4E1',
      createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      resolvedAt: null,
      satisfactionRating: null,
    },
    {
      hash: 'hash-demo-4',
      title: 'Unhygienic food storage and sour milk served at breakfast',
      description: 'The dairy refrigeration unit in the central canteen broke down, and sour dairy was still used in student meals.',
      catName: 'Canteen',
      locName: 'University Cafeteria & Food Court',
      priority: Priority.MEDIUM,
      status: ComplaintStatus.RESOLVED,
      pseudonym: 'Complainant #D88F',
      createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      resolvedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      satisfactionRating: 4,
    },
    {
      hash: 'hash-demo-5',
      title: 'Group intimidation and forced tasks demanded from 1st-year students',
      description: 'A group of senior students cornered first-year students demanding they complete assignments and perform humiliating tasks.',
      catName: 'Ragging',
      locName: 'Indoor Sports & Gym Pavilion',
      priority: Priority.CRITICAL,
      status: ComplaintStatus.TRIAGED,
      pseudonym: 'Complainant #E20A',
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      resolvedAt: null,
      satisfactionRating: null,
    },
    {
      hash: 'hash-demo-6',
      title: 'Air conditioning failure during mid-term examination hall 2B',
      description: 'Room temperature exceeded 38 degrees Celsius during exam hours; multiple students reported dizziness.',
      catName: 'Academic',
      locName: 'Main Administrative Block',
      priority: Priority.MEDIUM,
      status: ComplaintStatus.RESOLVED,
      pseudonym: 'Complainant #F51B',
      createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      resolvedAt: new Date(Date.now() - 9 * 24 * 3600 * 1000),
      satisfactionRating: 5,
    },
    {
      hash: 'hash-demo-7',
      title: 'Campus electric shuttle bus repeatedly skipping Gate 1 stop',
      description: 'Shuttle drivers skip the scheduled 8:30 AM student pickup on rainy days causing massive class delays.',
      catName: 'Transport',
      locName: 'Main Entrance & Gate 1',
      priority: Priority.LOW,
      status: ComplaintStatus.SUBMITTED,
      pseudonym: 'Complainant #G33C',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      resolvedAt: null,
      satisfactionRating: null,
    },
    {
      hash: 'hash-demo-8',
      title: 'Repeated harassment and stalking along south dormitory trail',
      description: 'An unidentified person on a bike has repeatedly harassed students walking back from library past 9 PM.',
      catName: 'Harassment',
      locName: 'South Campus Girls Hostel',
      priority: Priority.CRITICAL,
      status: ComplaintStatus.ESCALATED,
      pseudonym: 'Complainant #H74A',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      resolvedAt: null,
      satisfactionRating: null,
    },
  ];

  for (const sc of sampleComplaints) {
    const existing = await prisma.complaint.findUnique({ where: { trackingKeyHash: sc.hash } });
    if (!existing) {
      await prisma.complaint.create({
        data: {
          trackingKeyHash: sc.hash,
          title: sc.title,
          description: sc.description,
          categoryId: getCat(sc.catName),
          locationId: getLoc(sc.locName),
          priority: sc.priority,
          status: sc.status,
          pseudonym: sc.pseudonym,
          incidentAt: sc.createdAt,
          createdAt: sc.createdAt,
          resolvedAt: sc.resolvedAt,
          satisfactionRating: sc.satisfactionRating,
        },
      });
    }
  }
  console.log(`[Seed] Seeded ${sampleComplaints.length} representative complaints for analytics.`);

  // 9. Sample Notifications
  const adminUser = await prisma.user.findFirst({ where: { username: 'admin_case1' } });
  if (adminUser) {
    await prisma.notification.createMany({
      data: [
        {
          userId: adminUser.id,
          channel: 'IN_APP',
          type: 'SLA_BREACH',
          payload: {
            title: 'SLA Breach Warning',
            message: 'Case Complainant #H74A has reached CRITICAL SLA threshold.',
            priority: 'CRITICAL',
          },
          createdAt: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
          userId: adminUser.id,
          channel: 'IN_APP',
          type: 'CASE_ASSIGNED',
          payload: {
            title: 'New Case Assigned',
            message: 'You have been assigned to case Complainant #C4E1.',
            priority: 'HIGH',
          },
          createdAt: new Date(Date.now() - 1000 * 60 * 120),
        },
      ],
      skipDuplicates: true,
    });
    console.log('[Seed] Seeded sample admin notifications.');
  }

  console.log('[Seed] Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
