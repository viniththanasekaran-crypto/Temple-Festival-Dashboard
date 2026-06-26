import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// ─── Permission definitions ───────────────────────────────────────────────────

const PERMISSIONS = [
  // Temples
  { resource: 'temples', action: 'create', description: 'Create a new temple' },
  { resource: 'temples', action: 'read', description: 'View temple list and details' },
  { resource: 'temples', action: 'update', description: 'Edit temple details' },
  { resource: 'temples', action: 'delete', description: 'Delete a temple' },
  // Users / admins
  { resource: 'users', action: 'create', description: 'Create admin accounts' },
  { resource: 'users', action: 'read', description: 'View user list' },
  { resource: 'users', action: 'update', description: 'Edit user details' },
  { resource: 'users', action: 'deactivate', description: 'Deactivate a user account' },
  // Festivals
  { resource: 'festivals', action: 'create', description: 'Create a festival' },
  { resource: 'festivals', action: 'read', description: 'View festivals' },
  { resource: 'festivals', action: 'update', description: 'Edit festival details' },
  { resource: 'festivals', action: 'delete', description: 'Delete a festival' },
  // Families
  { resource: 'families', action: 'create', description: 'Add a family' },
  { resource: 'families', action: 'read', description: 'View families' },
  { resource: 'families', action: 'update', description: 'Edit family details' },
  { resource: 'families', action: 'delete', description: 'Delete a family' },
  { resource: 'families', action: 'import', description: 'Bulk import families via Excel' },
  // Payments
  { resource: 'payments', action: 'create', description: 'Record a payment' },
  { resource: 'payments', action: 'read', description: 'View payment history' },
  { resource: 'payments', action: 'update', description: 'Edit a cash payment amount' },
  // Reports
  { resource: 'reports', action: 'read', description: 'View reports' },
  { resource: 'reports', action: 'download', description: 'Download Excel/PDF reports' },
  // SMS / Reminders
  { resource: 'reminders', action: 'send', description: 'Send SMS/WhatsApp reminders' },
  { resource: 'reminders', action: 'schedule', description: 'Schedule SMS reminders' },
  // Dashboard
  { resource: 'dashboard', action: 'read', description: 'View dashboard' },
  // Gallery
  { resource: 'gallery', action: 'create', description: 'Upload temple gallery images' },
  { resource: 'gallery', action: 'delete', description: 'Delete temple gallery images' },
  // Profile
  { resource: 'profile', action: 'update', description: 'Update own profile / children list' },
]

// ─── Role → permission assignments ───────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: PERMISSIONS.map((p) => `${p.resource}:${p.action}`), // all

  admin: [
    'temples:read',
    'festivals:create',
    'festivals:read',
    'festivals:update',
    'festivals:delete',
    'families:create',
    'families:read',
    'families:update',
    'families:delete',
    'families:import',
    'payments:create',
    'payments:read',
    'payments:update',
    'reports:read',
    'reports:download',
    'reminders:send',
    'reminders:schedule',
    'dashboard:read',
    'gallery:create',
    'gallery:delete',
    'profile:update',
  ],

  viewer: [
    'festivals:read',
    'families:read',
    'payments:read',
    'dashboard:read',
    'profile:update', // update own children list
  ],
}

// ─── Tamil Nadu districts ─────────────────────────────────────────────────────

const TN_DISTRICTS = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kancheepuram',
  'Kanyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupattur',
  'Tiruppur',
  'Tiruvallur',
  'Tiruvannamalai',
  'Tiruvarur',
  'Vellore',
  'Villupuram',
  'Virudhunagar',
]

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding roles and permissions...')

  // Upsert all permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: { description: p.description },
      create: p,
    })
  }

  // Upsert roles and assign permissions
  const roles = [
    { name: 'super_admin', description: 'Full system access — manages all temples and admins' },
    { name: 'admin', description: 'Temple admin — manages festivals, families, payments' },
    { name: 'viewer', description: 'Family member — views own festival and payment status' },
  ]

  for (const roleDef of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: roleDef,
    })

    const permKeys = ROLE_PERMISSIONS[roleDef.name] ?? []
    for (const key of permKeys) {
      const [resource, action] = key.split(':')
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { resource_action: { resource, action } },
      })
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      })
    }

    console.log(`  ✓ role: ${roleDef.name} (${permKeys.length} permissions)`)
  }

  // Upsert 38 Tamil Nadu districts
  console.log('Seeding districts...')
  for (const name of TN_DISTRICTS) {
    await prisma.district.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log(`  ✓ ${TN_DISTRICTS.length} districts seeded`)

  // Upsert superadmin user
  console.log('Seeding superadmin user...')
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } })
  const hashedPassword = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'Admin@1234', 10)

  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: { roleId: superAdminRole.id },
    create: {
      username: 'superadmin',
      password: hashedPassword,
      roleId: superAdminRole.id,
    },
  })
  console.log('  ✓ superadmin user ready')

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
