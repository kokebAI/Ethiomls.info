/**
 * Set a real bcrypt password on an account (e.g. admin).
 * Usage: npx tsx scripts/set-user-password.ts +251911000001 'YourPassword!'
 */
import { normalizeEthiopiaPhone } from "../lib/auth/otp";
import { hashPassword, isPasswordStrong } from "../lib/auth/password";
import { prisma } from "../lib/db/prisma";

async function main() {
  const phoneRaw = process.argv[2] ?? "";
  const password = process.argv[3] ?? "";
  const phone = normalizeEthiopiaPhone(phoneRaw);
  if (!phone || !isPasswordStrong(password)) {
    console.error(
      "Usage: npx tsx scripts/set-user-password.ts <ethiopian-phone> <password-min-8>",
    );
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    console.error(`No user for ${phone}`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        phone,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
