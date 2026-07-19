import { randomUUID } from "node:crypto";
import {
  ConstructionStage,
  ListingStatus,
  ListingType,
  Prisma,
  PrismaClient,
  PropertyCategory,
  UserRole,
} from "@prisma/client";
import { allocateUniquePropertyId } from "../lib/db/allocatePropertyId";
import { amenityFlagsFromTags } from "../lib/properties/amenities";

const prisma = new PrismaClient();

/** Approximate centroids for Addis Ababa sub-cities (lon, lat WGS84). */
const ADDIS_SUB_CITIES: Array<{
  code: string;
  sortOrder: number;
  name: { en: string; am: string; om: string };
  description: { en: string; am: string; om: string };
  lon: number;
  lat: number;
}> = [
  {
    code: "addis-ketema",
    sortOrder: 1,
    name: {
      en: "Addis Ketema",
      am: "\u12A0\u12F2\u1235 \u12A8\u1270\u121B",
      om: "Addis Ketema",
    },
    description: {
      en: "Dense central sub-city west of Piazza and Merkato.",
      am: "\u12A8\u1352\u12EB\u1233 \u12A5\u1293 \u1218\u122D\u12AB\u1276 \u121D\u12D5\u122B\u1265 \u12E8\u121A\u1308\u129D \u1325\u1245\u1325\u1245 \u12EB\u1208 \u121B\u12D5\u12A8\u120B\u12CA \u12AD\u134D\u1208 \u12A8\u1270\u121B\u1362",
      om: "Magaalaa giddugaleessa tiyya Piazza fi Merkato ira.",
    },
    lon: 38.7245,
    lat: 9.0335,
  },
  {
    code: "akaky-kaliti",
    sortOrder: 2,
    name: {
      en: "Akaky Kaliti",
      am: "\u12A0\u1243\u1242 \u1243\u120A\u1272",
      om: "Akaakii Qalitii",
    },
    description: {
      en: "Southern industrial and residential expansion corridor.",
      am: "\u12E8\u12F0\u1261\u1265 \u12A2\u1295\u12F1\u1235\u1275\u122A\u12EB\u120D \u12A5\u1293 \u12E8\u1218\u1296\u122A\u12EB \u1218\u1235\u134B\u134B\u1275 \u12AE\u122A\u12F0\u122D\u1362",
      om: "Karaa babal'ina industirii fi mana jireenyaa kibbaa.",
    },
    lon: 38.7612,
    lat: 8.9108,
  },
  {
    code: "arada",
    sortOrder: 3,
    name: { en: "Arada", am: "\u12A0\u122B\u12F3", om: "Araadaa" },
    description: {
      en: "Historic core including Piazza and Churchill Avenue.",
      am: "\u1352\u12EB\u1233\u1295 \u12A5\u1293 \u1278\u122D\u127D\u120D \u12A0\u12F0\u1263\u1263\u12ED\u1295 \u12E8\u12EB\u12D8 \u1273\u122A\u12AB\u12CA \u121B\u12D5\u12A8\u120D\u1362",
      om: "Giddugaleessa seenaa Piazza fi Churchill Avenue of keessaa qabu.",
    },
    lon: 38.7516,
    lat: 9.0345,
  },
  {
    code: "bole",
    sortOrder: 4,
    name: { en: "Bole", am: "\u1266\u120C", om: "Boolee" },
    description: {
      en: "Airport-adjacent business district and premium housing.",
      am: "\u12A8\u12A0\u12E8\u122D \u121B\u1228\u134A\u12EB \u12A0\u1320\u1308\u1265 \u12E8\u1295\u130D\u12F5 \u12A5\u1293 \u12A8\u134D\u1270\u129B \u12E8\u1218\u1296\u122A\u12EB \u12A0\u12AB\u1263\u1262\u1362",
      om: "Naannoo daldalaa fi mana jireenyaa olaanaa aeroportii biratti.",
    },
    lon: 38.7895,
    lat: 8.9942,
  },
  {
    code: "gullele",
    sortOrder: 5,
    name: { en: "Gullele", am: "\u1309\u1208\u120C", om: "Gullelee" },
    description: {
      en: "Northern hillside neighborhoods above Entoto approaches.",
      am: "\u12A8\u12A5\u1295\u1326\u1326 \u12A0\u1245\u122B\u1262\u12EB \u1260\u1230\u121C\u1295 \u1270\u122B\u122B\u121B \u12E8\u121A\u1308\u129D \u1230\u1348\u122E\u127D\u1362",
      om: "Naannoo gaaree kaabaa Entoto biratti.",
    },
    lon: 38.7258,
    lat: 9.0652,
  },
  {
    code: "kirkos",
    sortOrder: 6,
    name: { en: "Kirkos", am: "\u1242\u122D\u1246\u1235", om: "Qirqoos" },
    description: {
      en: "Central corridor linking Meskel Square and Kasanchis.",
      am: "\u1218\u1235\u1240\u120D \u12A0\u12F0\u1263\u1263\u12ED\u1295 \u12A5\u1293 \u12AB\u1233\u1295\u127A\u1235\u1295 \u12E8\u121A\u12EB\u1308\u129B\u129D \u121B\u12D5\u12A8\u120B\u12CA \u12AE\u122A\u12F0\u122D\u1362",
      om: "Karaa giddugaleessa Meskel Square fi Kasanchis walqunnamsiisu.",
    },
    lon: 38.7631,
    lat: 9.0108,
  },
  {
    code: "kolfe-keranio",
    sortOrder: 7,
    name: {
      en: "Kolfe Keranio",
      am: "\u12AE\u120D\u134C \u1240\u122B\u1295\u12EE",
      om: "Kolfee Qeraaniyoo",
    },
    description: {
      en: "Western residential sub-city toward Asko and Tor Hailoch.",
      am: "\u12C8\u12F0 \u12A0\u1235\u12AE \u12A5\u1293 \u1276\u122D \u1203\u12ED\u120E\u127D \u12E8\u121A\u12EB\u12EB\u12ED\u12DD \u121D\u12D5\u122B\u1263\u12CA \u12E8\u1218\u1296\u122A\u12EB \u12AD\u134D\u1208 \u12A8\u1270\u121B\u1362",
      om: "Magaalaa golaa dhihaa Asko fi Tor Hailochgeetti.",
    },
    lon: 38.6824,
    lat: 9.0215,
  },
  {
    code: "lideta",
    sortOrder: 8,
    name: { en: "Lideta", am: "\u120D\u12F0\u1273", om: "Lidetaa" },
    description: {
      en: "Central-west district near Mexico Square and Autobus Terra.",
      am: "\u12A8\u121C\u12AD\u1235\u12AE \u12A0\u12F0\u1263\u1263\u12ED \u12A5\u1293 \u12A0\u12CD\u1276\u1261\u1235 \u1270\u122B \u12A0\u1320\u1308\u1265 \u12EB\u1208 \u121B\u12D5\u12A8\u120B\u12CA-\u121D\u12D5\u122B\u1265 \u12AD\u134D\u1208 \u12A8\u1270\u121B\u1362",
      om: "Magaalaa giddugaleessa-dhihaa Mexico Square fi Autobus Terra biratti.",
    },
    lon: 38.7378,
    lat: 9.0102,
  },
  {
    code: "nifas-silk-lafto",
    sortOrder: 9,
    name: {
      en: "Nifas Silk-Lafto",
      am: "\u1295\u134B\u1235 \u1235\u120D\u12AD \u120B\u134D\u1276",
      om: "Nifaas Silqii-Laaftoo",
    },
    description: {
      en: "Southwest residential expansion including Lafto.",
      am: "\u120B\u134D\u1276\u1295 \u12E8\u121A\u12EB\u12AB\u1275\u1275 \u12F0\u1261\u1265 \u121D\u12D5\u122B\u1265 \u12E8\u1218\u1296\u122A\u12EB \u1218\u1235\u134B\u134B\u1275\u1362",
      om: "Babal'ina mana jireenyaa kibba-dhihaa Laftoo of keessaa qabu.",
    },
    lon: 38.7248,
    lat: 8.9645,
  },
  {
    code: "yeka",
    sortOrder: 10,
    name: { en: "Yeka", am: "\u12E8\u12AB", om: "Yeekaa" },
    description: {
      en: "Northeast hillside neighborhoods including CMC approaches.",
      am: "\u1232\u12A4\u121D\u1232 \u12A0\u1245\u122B\u1262\u12EB\u1295 \u12E8\u121A\u12EB\u12AB\u1275\u1271 \u1230\u121C\u1295 \u121D\u1235\u122B\u1245 \u1270\u122B\u122B\u121B \u1230\u1348\u122E\u127D\u1362",
      om: "Naannoo gaaree kaaba-bahaa CMC biratti.",
    },
    lon: 38.8265,
    lat: 9.0228,
  },
  {
    code: "lemi-kura",
    sortOrder: 11,
    name: {
      en: "Lemi Kura",
      am: "\u1208\u121A \u12A9\u122B",
      om: "Leemii Kuraa",
    },
    description: {
      en: "Eastern expansion corridor and newer residential developments.",
      am: "\u121D\u1235\u122B\u1243\u12CA \u1218\u1235\u134B\u134B\u1275 \u12AE\u122A\u12F0\u122D \u12A5\u1293 \u12A0\u12F2\u1235 \u12E8\u1218\u1296\u122A\u12EB \u120D\u121B\u1276\u127D\u1362",
      om: "Karaa babal'ina bahaa fi misooma mana jireenyaa haaraa.",
    },
    lon: 38.8782,
    lat: 9.0056,
  },
];

const MOCK_DEVELOPERS: Array<{
  email: string;
  fullName: string;
  phone: string;
  tradeName: string;
  displayName: { en: string; am: string; om: string };
  registrationNumber: string;
  licenseNumber: string;
  tin: string;
  website: string;
  hqCode: string;
}> = [
  {
    email: "dev.sunshine@ethiomls.local",
    fullName: "Sunshine Homes Admin",
    phone: "+251911000101",
    tradeName: "Sunshine Homes PLC",
    displayName: {
      en: "Sunshine Homes",
      am: "\u1230\u1295\u123B\u12ED\u1295 \u1206\u121D\u1235",
      om: "Sunshine Homes",
    },
    registrationNumber: "ET-RE-2024-00042",
    licenseNumber: "MUD-RE-ADD-0042",
    tin: "0005123456",
    website: "https://example.com/sunshine-homes",
    hqCode: "bole",
  },
  {
    email: "dev.riftvalley@ethiomls.local",
    fullName: "Rift Valley Developers Admin",
    phone: "+251911000102",
    tradeName: "Rift Valley Developers S.C.",
    displayName: {
      en: "Rift Valley Developers",
      am: "\u122D\u134D\u1275 \u126B\u120A \u12F2\u1268\u120E\u1350\u122D\u1235",
      om: "Rift Valley Developers",
    },
    registrationNumber: "ET-RE-2023-00118",
    licenseNumber: "MUD-RE-ADD-0118",
    tin: "0005987654",
    website: "https://example.com/rift-valley",
    hqCode: "yeka",
  },
  {
    email: "dev.highland@ethiomls.local",
    fullName: "Highland Estates Admin",
    phone: "+251911000103",
    tradeName: "Highland Estates PLC",
    displayName: {
      en: "Highland Estates",
      am: "\u1203\u12ED\u120B\u1295\u12F5 \u12A2\u1235\u1274\u1275\u1235",
      om: "Highland Estates",
    },
    registrationNumber: "ET-RE-2022-00077",
    licenseNumber: "MUD-RE-ADD-0077",
    tin: "0005456789",
    website: "https://example.com/highland-estates",
    hqCode: "kirkos",
  },
];

/** bcrypt hash for local seed password `ChangeMe123!` — rotate before any real deploy. */
const SEED_PASSWORD_HASH =
  "$2y$10$68EdlveS1tr1M7qKMc1LRe8IxSCP6i29X8KVP13zCSTACTJjw9WTq";

/**
 * Shared demo login password: `Demo123!`
 * (bcrypt cost 10 — local/dev only; rotate before any real deploy.)
 */
const DEMO_PASSWORD_HASH =
  "$2b$10$YcR/lokBIO83YekKTPAOX.8wmPSi9HV/80/yriHPBtP0nPhUzeBui";

type DemoUserSeed = {
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  localePrefs: string[];
  delala?: {
    displayName: { en: string; am: string; om: string };
    licenseNumber: string;
    operatingSubCityCode: string;
  };
  developer?: {
    tradeName: string;
    displayName: { en: string; am: string; om: string };
    registrationNumber: string;
    licenseNumber: string;
    tin: string;
    website: string;
    hqCode: string;
  };
};

const DEMO_USERS: DemoUserSeed[] = [
  {
    email: "support@agtplc.com",
    phone: "+251911000001",
    fullName: "AGT Support Admin",
    role: UserRole.ADMIN,
    localePrefs: ["en", "am"],
  },
  {
    email: "client@ethiomls.local",
    phone: "+251911000002",
    fullName: "Demo Client",
    role: UserRole.BUYER_RENTER,
    localePrefs: ["am", "en"],
  },
  {
    email: "broker@ethiomls.local",
    phone: "+251911000003",
    fullName: "Demo Broker",
    role: UserRole.INDEPENDENT_DELALA,
    localePrefs: ["am", "en"],
    delala: {
      displayName: {
        en: "Demo Brokerage",
        am: "የማሳያ ደላላ",
        om: "Daldalaa Fakkeenyaa",
      },
      licenseNumber: "ADD-BRK-DEMO-0003",
      operatingSubCityCode: "bole",
    },
  },
  {
    email: "owner@ethiomls.local",
    phone: "+251911000004",
    fullName: "Demo Owner",
    role: UserRole.PROPERTY_OWNER,
    localePrefs: ["am", "en"],
  },
  {
    email: "developer@ethiomls.local",
    phone: "+251911000005",
    fullName: "Demo Developer",
    role: UserRole.CORPORATE_DEVELOPER,
    localePrefs: ["en", "am"],
    developer: {
      tradeName: "Demo Real Estate PLC",
      displayName: {
        en: "Demo Real Estate",
        am: "የማሳያ ሪል እስቴት",
        om: "Qabeenya Manaa Fakkeenyaa",
      },
      registrationNumber: "ET-RE-DEMO-00005",
      licenseNumber: "MUD-RE-DEMO-0005",
      tin: "0005999005",
      website: "https://ethiomls.info",
      hqCode: "bole",
    },
  },
];

async function seedDemoUsers() {
  const subCities = await prisma.subCity.findMany();
  const byCode = new Map(subCities.map((s) => [s.code, s.id]));

  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { phone: demo.phone },
      update: {
        email: demo.email,
        fullName: demo.fullName,
        passwordHash: DEMO_PASSWORD_HASH,
        role: demo.role,
        isActive: true,
        localePrefs: demo.localePrefs,
      },
      create: {
        email: demo.email,
        phone: demo.phone,
        passwordHash: DEMO_PASSWORD_HASH,
        fullName: demo.fullName,
        role: demo.role,
        localePrefs: demo.localePrefs,
      },
    });

    if (demo.delala) {
      const operatingSubCityId = byCode.get(demo.delala.operatingSubCityCode);
      if (!operatingSubCityId) {
        throw new Error(
          `Missing sub-city for delala ${demo.email}: ${demo.delala.operatingSubCityCode}`,
        );
      }

      await prisma.delalaProfile.upsert({
        where: { userId: user.id },
        update: {
          displayName: demo.delala.displayName,
          licenseNumber: demo.delala.licenseNumber,
          operatingSubCityId,
          isVerified: true,
        },
        create: {
          userId: user.id,
          displayName: demo.delala.displayName,
          licenseNumber: demo.delala.licenseNumber,
          operatingSubCityId,
          isVerified: true,
        },
      });
    }

    if (demo.developer) {
      const hqId = byCode.get(demo.developer.hqCode);
      if (!hqId) {
        throw new Error(
          `Missing HQ sub-city for developer ${demo.email}: ${demo.developer.hqCode}`,
        );
      }

      await prisma.developerProfile.upsert({
        where: { registrationNumber: demo.developer.registrationNumber },
        update: {
          tradeName: demo.developer.tradeName,
          displayName: demo.developer.displayName,
          licenseNumber: demo.developer.licenseNumber,
          tin: demo.developer.tin,
          website: demo.developer.website,
          headquartersSubCityId: hqId,
          isVerified: true,
          userId: user.id,
        },
        create: {
          userId: user.id,
          tradeName: demo.developer.tradeName,
          displayName: demo.developer.displayName,
          registrationNumber: demo.developer.registrationNumber,
          licenseNumber: demo.developer.licenseNumber,
          tin: demo.developer.tin,
          website: demo.developer.website,
          headquartersSubCityId: hqId,
          isVerified: true,
          licenseExpiresAt: new Date("2029-12-31T00:00:00.000Z"),
        },
      });
    }
  }

  console.log(`Seeded ${DEMO_USERS.length} demo persona users (password: Demo123!).`);
}

async function seedSubCities() {
  for (const sc of ADDIS_SUB_CITIES) {
    const existing = await prisma.subCity.findUnique({
      where: { code: sc.code },
    });
    const id = existing?.id ?? randomUUID();

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "sub_cities" (
        "id", "code", "name", "description", "city", "region",
        "sortOrder", "isActive", "centroid", "createdAt", "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3::jsonb,
        $4::jsonb,
        'Addis Ababa',
        'Addis Ababa',
        $5,
        true,
        ST_SetSRID(ST_MakePoint($6::double precision, $7::double precision), 4326),
        NOW(),
        NOW()
      )
      ON CONFLICT ("code") DO UPDATE SET
        "name" = EXCLUDED."name",
        "description" = EXCLUDED."description",
        "sortOrder" = EXCLUDED."sortOrder",
        "centroid" = EXCLUDED."centroid",
        "updatedAt" = NOW()
      `,
      id,
      sc.code,
      JSON.stringify(sc.name),
      JSON.stringify(sc.description),
      sc.sortOrder,
      sc.lon,
      sc.lat,
    );
  }

  console.log(`Seeded ${ADDIS_SUB_CITIES.length} Addis Ababa sub-cities.`);
}

async function seedMockDevelopers() {
  const subCities = await prisma.subCity.findMany();
  const byCode = new Map(subCities.map((s) => [s.code, s.id]));

  for (const dev of MOCK_DEVELOPERS) {
    const hqId = byCode.get(dev.hqCode);
    if (!hqId) {
      throw new Error(`Missing sub-city for HQ code: ${dev.hqCode}`);
    }

    const user = await prisma.user.upsert({
      where: { email: dev.email },
      update: {
        fullName: dev.fullName,
        phone: dev.phone,
        role: UserRole.CORPORATE_DEVELOPER,
        isActive: true,
      },
      create: {
        email: dev.email,
        phone: dev.phone,
        passwordHash: SEED_PASSWORD_HASH,
        fullName: dev.fullName,
        role: UserRole.CORPORATE_DEVELOPER,
        localePrefs: ["am", "en"],
      },
    });

    await prisma.developerProfile.upsert({
      where: { registrationNumber: dev.registrationNumber },
      update: {
        tradeName: dev.tradeName,
        displayName: dev.displayName,
        licenseNumber: dev.licenseNumber,
        tin: dev.tin,
        website: dev.website,
        headquartersSubCityId: hqId,
        isVerified: true,
        userId: user.id,
      },
      create: {
        userId: user.id,
        tradeName: dev.tradeName,
        displayName: dev.displayName,
        registrationNumber: dev.registrationNumber,
        licenseNumber: dev.licenseNumber,
        tin: dev.tin,
        website: dev.website,
        headquartersSubCityId: hqId,
        isVerified: true,
        licenseExpiresAt: new Date("2028-12-31T00:00:00.000Z"),
      },
    });
  }

  console.log(`Seeded ${MOCK_DEVELOPERS.length} mock corporate developers.`);
}

const MOCK_PROJECTS: Array<{
  id: string;
  registrationNumber: string;
  subCityCode: string;
  title: { en: string; am: string; om: string };
  description: { en: string; am: string; om: string };
  constructionStage: ConstructionStage;
  completionPercent: number;
}> = [
  {
    id: "seed-project-sunshine-heights",
    registrationNumber: "ET-RE-2024-00042",
    subCityCode: "bole",
    title: {
      en: "Sunshine Heights",
      am: "ሰንሻይን ሃይትስ",
      om: "Sunshine Heights",
    },
    description: {
      en: "Premium off-plan tower beside Bole Road with escrow-stage tracking.",
      am: "ከቦሌ መንገድ አጠገብ የሚገነባ የፕሪሚየም ከፍተኛ ህንፃ።",
      om: "Gamoo olaanaa Bole Road biratti ijaarame.",
    },
    constructionStage: ConstructionStage.SUPERSTRUCTURE,
    completionPercent: 62,
  },
  {
    id: "seed-project-rift-valley-plaza",
    registrationNumber: "ET-RE-2023-00118",
    subCityCode: "yeka",
    title: {
      en: "Rift Valley Plaza",
      am: "ሪፍት ቫሊ ፕላዛ",
      om: "Rift Valley Plaza",
    },
    description: {
      en: "Mixed-use plaza in northeast Addis with MEP installation underway.",
      am: "በሰሜን ምሥራቅ አዲስ አበባ የሚገነባ የተቀናጀ አጠቃቀም ፕላዛ።",
      om: "Plaza fayyaa walitti makamee Addis kaaba-bahaa keessatti.",
    },
    constructionStage: ConstructionStage.MEP_INSTALLATION,
    completionPercent: 78,
  },
  {
    id: "seed-project-highland-courts",
    registrationNumber: "ET-RE-2022-00077",
    subCityCode: "kirkos",
    title: {
      en: "Highland Courts",
      am: "ሃይላንድ ኮርትስ",
      om: "Highland Courts",
    },
    description: {
      en: "Boutique residential courts near Meskel Square.",
      am: "ከመስቀል አደባባይ አቅራቢያ የሚገነባ ትንሽ የመኖሪያ ቤቶች።",
      om: "Mana jireenyaa Meskel Square biratti.",
    },
    constructionStage: ConstructionStage.EARTHWORKS_FOUNDATION,
    completionPercent: 18,
  },
];

async function seedMockProjects() {
  const subCities = await prisma.subCity.findMany();
  const byCode = new Map(subCities.map((s) => [s.code, s.id]));
  const developers = await prisma.developerProfile.findMany();
  const byRegistration = new Map(
    developers.map((d) => [d.registrationNumber, d.id]),
  );

  for (const project of MOCK_PROJECTS) {
    const developerId = byRegistration.get(project.registrationNumber);
    const subCityId = byCode.get(project.subCityCode);

    if (!developerId || !subCityId) {
      throw new Error(
        `Missing developer or sub-city for project ${project.id}`,
      );
    }

    await prisma.project.upsert({
      where: { id: project.id },
      update: {
        title: project.title,
        description: project.description,
        constructionStage: project.constructionStage,
        completionPercent: project.completionPercent,
        status: ListingStatus.PENDING_REVIEW,
        publishedAt: null,
        adminAuditApprovedAt: null,
        adminAuditedById: null,
        adminAuditNotes: null,
        adminAuditChecklist: Prisma.DbNull,
        developerId,
        subCityId,
      },
      create: {
        id: project.id,
        developerId,
        subCityId,
        title: project.title,
        description: project.description,
        constructionStage: project.constructionStage,
        completionPercent: project.completionPercent,
        status: ListingStatus.PENDING_REVIEW,
        requiresEscrow: true,
      },
    });
  }

  console.log(
    `Seeded ${MOCK_PROJECTS.length} off-plan projects (PENDING_REVIEW — admin audit required).`,
  );
}

async function seedSubCityListings() {
  const subCities = await prisma.subCity.findMany({ orderBy: { sortOrder: "asc" } });
  const developers = await prisma.developerProfile.findMany({
    include: { user: true },
    orderBy: { tradeName: "asc" },
  });

  if (developers.length === 0) {
    throw new Error("Seed developers before listings.");
  }

  const publishedAt = new Date("2026-07-01T00:00:00.000Z");

  for (const [index, subCity] of subCities.entries()) {
    const developer = developers[index % developers.length];
    const name =
      subCity.name && typeof subCity.name === "object" && !Array.isArray(subCity.name)
        ? (subCity.name as Record<string, string>)
        : { en: subCity.code, am: subCity.code, om: subCity.code };

    const seedKey = `seed:subcity:${subCity.code}`;
    const bedrooms = 2 + (index % 3);
    const priceAmount = 4_500_000 + index * 350_000;
    const existingListing = await prisma.listing.findFirst({
      where: { metadataTags: { has: seedKey } },
      select: { id: true },
    });
    const listingId =
      existingListing?.id ?? (await allocateUniquePropertyId(prisma));

    const listingPayload = {
      title: {
        en: `${name.en} Garden Residence`,
        am: `${name.am} የአትክልት መኖሪያ`,
        om: `${name.om} Mana Jireenyaa`,
      },
      description: {
        en: `Verified ${name.en} listing with municipal sub-city metadata.`,
        am: `የ${name.am} ክፍለ ከተማ የተረጋገጠ ዝርዝር።`,
        om: `Tarree ${name.om} mirkanaa'e.`,
      },
      status: ListingStatus.PUBLISHED,
      publishedAt,
      subCityId: subCity.id,
      developerId: developer.id,
      ownerId: developer.userId,
      priceAmount,
      bedrooms,
      bathrooms: Math.max(1, bedrooms - 1),
      floorAreaSqm: 85 + index * 8,
      listingType: index % 4 === 0 ? ListingType.RENT : ListingType.SALE,
      category: PropertyCategory.RESIDENTIAL,
      metadataTags: [seedKey, "parking", "security", "water", `pid:${listingId}`],
      ...amenityFlagsFromTags([
        "parking",
        "security",
        "water",
        index % 2 === 0 ? "power-backup" : "",
        index % 3 === 0 ? "elevator" : "",
      ]),
    };

    if (existingListing) {
      await prisma.listing.update({
        where: { id: listingId },
        data: listingPayload,
      });
    } else {
      await prisma.listing.create({
        data: { id: listingId, ...listingPayload },
      });
    }
  }

  console.log(`Seeded ${subCities.length} published sub-city listings.`);
}

async function main() {
  await seedSubCities();
  await seedDemoUsers();
  await seedMockDevelopers();
  await seedMockProjects();
  await seedSubCityListings();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
