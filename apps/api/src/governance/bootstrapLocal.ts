/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Local Tenant and Admin Bootstrap
 * Introduction: Idempotent default tenant and GOVERNANCE_ADMIN user for local/ops use.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { PrismaClient } from "@prisma/client";

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const TENANT_NAME = process.env.FLAHA_BOOTSTRAP_TENANT_NAME?.trim() || "Flaha Local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
const ADMIN_NAME = process.env.FLAHA_BOOTSTRAP_ADMIN_NAME?.trim() || "Flaha Local Admin";

const prisma = new PrismaClient();

try {
  const tenant = await prisma.tenant.upsert({
    where: { code: TENANT_CODE },
    create: { code: TENANT_CODE, name: TENANT_NAME, active: true },
    update: { name: TENANT_NAME, active: true },
  });

  const user = await prisma.userAccount.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      displayName: ADMIN_NAME,
      active: true,
      memberships: {
        create: {
          tenantId: tenant.id,
          role: "GOVERNANCE_ADMIN",
          active: true,
        },
      },
    },
    update: { displayName: ADMIN_NAME, active: true },
  });

  const membership = await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: "GOVERNANCE_ADMIN",
      active: true,
    },
    update: { role: "GOVERNANCE_ADMIN", active: true },
  });

  console.log(
    JSON.stringify(
      {
        tenantId: tenant.id,
        tenantCode: tenant.code,
        userId: user.id,
        email: user.email,
        role: membership.role,
        note: "Use POST /api/auth/session with userId + tenantId in development AUTH_MODE, or product login path in production.",
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
