import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@crm.fr" },
    update: {},
    create: {
      email: "admin@crm.fr",
      name: "Admin CRM",
      passwordHash: adminPassword,
      role: "ADMIN",
      maxProspects: 999,
    },
  });
  console.log("Admin created:", admin.email);

  // Create a commercial user
  const commercialPassword = await hash("commercial123", 12);
  const commercial = await prisma.user.upsert({
    where: { email: "commercial@crm.fr" },
    update: {},
    create: {
      email: "commercial@crm.fr",
      name: "Jean Commercial",
      passwordHash: commercialPassword,
      role: "COMMERCIAL",
      maxProspects: 50,
    },
  });
  console.log("Commercial created:", commercial.email);

  // Create a teleprospecteur user
  const telePassword = await hash("tele123", 12);
  const tele = await prisma.user.upsert({
    where: { email: "tele@crm.fr" },
    update: {},
    create: {
      email: "tele@crm.fr",
      name: "Marie Teleprospection",
      passwordHash: telePassword,
      role: "TELEPROSPECTEUR",
      maxProspects: 100,
    },
  });
  console.log("Teleprospecteur created:", tele.email);

  // Create NAF sections with score bonuses
  const nafSections = [
    { code: "47", label: "Commerce de détail", scoreBonus: 20, isHighValue: true },
    { code: "56", label: "Restauration", scoreBonus: 20, isHighValue: true },
    { code: "62", label: "Programmation informatique", scoreBonus: 15, isHighValue: true },
    { code: "68", label: "Activités immobilières", scoreBonus: 20, isHighValue: true },
    { code: "69", label: "Activités juridiques et comptables", scoreBonus: 15, isHighValue: true },
    { code: "70", label: "Conseil de gestion", scoreBonus: 15, isHighValue: true },
    { code: "71", label: "Architecture et ingénierie", scoreBonus: 15, isHighValue: true },
    { code: "73", label: "Publicité et études de marché", scoreBonus: 15, isHighValue: true },
    { code: "74", label: "Autres activités spécialisées", scoreBonus: 10, isHighValue: false },
    { code: "82", label: "Activités de soutien aux entreprises", scoreBonus: 10, isHighValue: false },
    { code: "85", label: "Enseignement", scoreBonus: 10, isHighValue: false },
    { code: "86", label: "Activités pour la santé humaine", scoreBonus: 15, isHighValue: true },
    { code: "93", label: "Activités sportives et de loisirs", scoreBonus: 10, isHighValue: false },
    { code: "96", label: "Autres services personnels", scoreBonus: 15, isHighValue: true },
  ];

  for (const naf of nafSections) {
    await prisma.nafSection.upsert({
      where: { code: naf.code },
      update: naf,
      create: naf,
    });
  }
  console.log(`${nafSections.length} NAF sections created`);

  // Create default system settings
  const settings = [
    { key: "score_threshold_qualify", value: "40", type: "number" },
    { key: "score_threshold_hot", value: "70", type: "number" },
    { key: "max_enrichment_per_day", value: "500", type: "number" },
    { key: "inpi_detection_cron", value: "0 6 * * *", type: "string" },
    { key: "max_parallel_enrichments", value: "3", type: "number" },
    { key: "auto_assign_enabled", value: "true", type: "boolean" },
    { key: "auto_qualify_enabled", value: "true", type: "boolean" },
    { key: "pappers_daily_budget", value: "200", type: "number" },
    { key: "google_places_daily_budget", value: "1000", type: "number" },
    { key: "follow_up_default_days", value: "7", type: "number" },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, type: setting.type },
      create: setting,
    });
  }
  console.log(`${settings.length} system settings created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
