import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildGovernedSeedPlan } from "./governedData.js";

const taxonomyDirectory = fileURLToPath(new URL("../../../../docs/taxonomy/", import.meta.url));
const plan = await buildGovernedSeedPlan(taxonomyDirectory);
const prisma = new PrismaClient();

try {
  await prisma.$transaction(async (transaction) => {
    const ids = new Map<string, string>();
    for (const term of plan.classificationTerms) {
      const saved = await transaction.classificationTerm.upsert({
        where: { type_code: { type: term.type, code: term.code } },
        create: {
          type: term.type,
          code: term.code,
          label: term.label,
          description: term.description,
          standardCode: term.standardCode,
          aliases: term.aliases,
          entityEligibility: term.entityEligibility,
          assignable: term.assignable,
          active: term.active,
          sortOrder: term.sortOrder,
        },
        update: {
          label: term.label,
          description: term.description,
          standardCode: term.standardCode,
          aliases: term.aliases,
          entityEligibility: term.entityEligibility,
          assignable: term.assignable,
          active: term.active,
          sortOrder: term.sortOrder,
        },
        select: { id: true },
      });
      ids.set(`${term.type}:${term.code}`, saved.id);
    }

    for (const term of plan.classificationTerms) {
      const id = ids.get(`${term.type}:${term.code}`);
      const parentId = term.parentCode ? ids.get(`${term.type}:${term.parentCode}`) : null;
      if (!id || (term.parentCode && !parentId)) {
        throw new Error(`Unable to resolve taxonomy hierarchy for ${term.type}:${term.code}.`);
      }
      await transaction.classificationTerm.update({ where: { id }, data: { parentId } });
    }

    for (const type of plan.organizationTypes) {
      await transaction.organizationType.upsert({
        where: { code: type.code },
        create: type,
        update: {
          label: type.label,
          description: type.description,
          active: type.active,
          sortOrder: type.sortOrder,
        },
      });
    }
  }, { maxWait: 10_000, timeout: 120_000 });

  console.log(`Seeded ${plan.classificationTerms.length} classification terms and ${plan.organizationTypes.length} organization types.`);
} finally {
  await prisma.$disconnect();
}
