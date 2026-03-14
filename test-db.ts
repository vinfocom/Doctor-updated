import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
    const staff = await prisma.clinic_staff.findMany({ include: { users: true, clinics: true } });
    console.log("All Staff records:");
    console.dir(staff, { depth: null });

    const users = await prisma.users.findMany({ where: { role: 'CLINIC_STAFF' } });
    console.log("\nStaff Users:");
    console.dir(users, { depth: null });
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
